"""Small filesystem safeguards; no application or analyzer imports."""
from contextlib import contextmanager
import hashlib
import os
import plistlib
import stat
import tempfile
import zipfile


class ArtifactError(ValueError):
    status_code = 400


class ArtifactConflict(ArtifactError):
    status_code = 409


def artifact_path(folder, filename):
    if (not filename or filename in ('.', '..') or filename.startswith('.')
            or '/' in filename or '\\' in filename or ':' in filename
            or any(ord(char) < 32 for char in filename)):
        raise ArtifactError('Invalid artifact filename')
    path = os.path.join(os.path.abspath(folder), filename)
    if os.path.islink(path):
        raise ArtifactConflict('Artifact symlinks are not supported')
    return path


def apk_identity(apk):
    package = (apk.get_package() or '').strip()
    if not package:
        raise ArtifactError('APK has no package name')
    version = (apk.get_androidversion_name() or '').strip() or 'Unknown'
    return package, version


def unique_record(records):
    records = list(records)
    if len(records) > 1:
        raise ArtifactConflict('Artifact identity is ambiguous; select an exact uploaded file')
    return records[0] if records else None


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def validate_ipa(path):
    try:
        with zipfile.ZipFile(path) as archive:
            candidates = [item for item in archive.infolist()
                          if len(item.filename.split('/')) == 3
                          and item.filename.startswith('Payload/')
                          and item.filename.split('/')[1].endswith('.app')
                          and item.filename.endswith('/Info.plist')]
            if len(candidates) != 1 or candidates[0].file_size > 1024 * 1024:
                raise ArtifactError('IPA must contain one application Info.plist')
            info = plistlib.loads(archive.read(candidates[0]))
            if (not isinstance(info, dict)
                    or not isinstance(info.get('CFBundleIdentifier'), str)
                    or not info['CFBundleIdentifier'].strip()):
                raise ArtifactError('IPA has no application bundle identifier')
    except (zipfile.BadZipFile, plistlib.InvalidFileException, RuntimeError) as exc:
        raise ArtifactError('Invalid IPA archive') from exc


@contextmanager
def artifact_mutation(folder):
    """Serialize workers with a lock released by the OS on process exit.

    Keep the hidden lock file: unlinking it could let new callers lock a
    different inode while an existing waiter still references the old one.
    """
    lock = os.path.join(os.path.abspath(folder), '.audit-mutation.lock')
    if os.path.islink(lock):
        raise ArtifactConflict('Artifact lock must be a regular file')
    descriptor = os.open(lock, os.O_RDWR | os.O_CREAT | getattr(os, 'O_NOFOLLOW', 0), 0o600)
    locked = False
    try:
        if not stat.S_ISREG(os.fstat(descriptor).st_mode):
            raise ArtifactConflict('Artifact lock must be a regular file')
        if os.name == 'nt':
            import msvcrt
            if os.fstat(descriptor).st_size == 0:
                os.write(descriptor, b'\0')
            os.lseek(descriptor, 0, os.SEEK_SET)
            try:
                msvcrt.locking(descriptor, msvcrt.LK_NBLCK, 1)
            except OSError as exc:
                raise ArtifactConflict('Another artifact update is in progress; retry later') from exc
        else:
            import fcntl
            try:
                fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError as exc:
                raise ArtifactConflict('Another artifact update is in progress; retry later') from exc
        locked = True
        yield
    finally:
        try:
            if locked:
                if os.name == 'nt':
                    os.lseek(descriptor, 0, os.SEEK_SET)
                    msvcrt.locking(descriptor, msvcrt.LK_UNLCK, 1)
                else:
                    fcntl.flock(descriptor, fcntl.LOCK_UN)
        finally:
            os.close(descriptor)


def store_upload(upload, folder, filename, prepare, commit, rollback):
    """Validate staged bytes, publish without replacement, then commit metadata.

    prepare may stage database changes but must not commit them. The temporary
    file is on the destination filesystem so hard-link publication is atomic.
    Unsupported hard links fail closed. A process crash between publication and
    commit can leave an unindexed file, but cannot overwrite an existing file.
    """
    destination = artifact_path(folder, filename)
    with artifact_mutation(folder):
        if os.path.lexists(destination):
            raise ArtifactConflict('An artifact with this filename already exists')
        descriptor, staged = tempfile.mkstemp(prefix='.audit-upload-', dir=folder)
        os.close(descriptor)
        published = False
        try:
            upload.save(staged)
            prepare(staged)
            try:
                os.link(staged, destination)
            except FileExistsError as exc:
                raise ArtifactConflict('An artifact with this filename already exists') from exc
            published = True
            commit()
        except Exception:
            try:
                rollback()
            finally:
                if published:
                    os.unlink(destination)
            raise
        finally:
            os.unlink(staged)
