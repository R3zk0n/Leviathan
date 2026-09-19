"""Download / pull file-transfer endpoints."""
from project.api.frida._shared import *  # noqa: F401,F403  (shared surface)
from project.api.frida.helpers import *  # noqa: F401,F403  (helper functions)


@frida_namespace.route('/download/<string:download_id>')
class FridaDownload(Resource):
    def get(self, download_id):
        try:
            if download_id not in download_cache:
                return {"status": "error", "message": "Download expired or not found"}, 404

            file_info = download_cache[download_id]
            file_path = file_info['path']
            identifier = file_info['identifier']
            file_type = file_info.get('file_type', 'binary')  # Default to binary if not specified

            if not os.path.exists(file_path):
                return {"status": "error", "message": "File not found"}, 404

            @after_this_request
            def cleanup(response):
                try:
                    os.remove(file_path)
                    del download_cache[download_id]
                except Exception as e:
                    logger.error(f"Error cleaning up file: {e}")
                return response

            # Set appropriate filename and mimetype based on file type
            mime_types = {
                'apk': 'application/vnd.android.package-archive',
                'ipa': 'application/octet-stream',
                'binary': 'application/octet-stream'
            }

            download_name = f"{identifier}.{file_type}"
            mime_type = mime_types.get(file_type, 'application/octet-stream')

            return send_file(
                path_or_file=file_path,
                mimetype=mime_type,
                as_attachment=True,
                download_name=download_name
            )

        except Exception as e:
            logger.exception(f"Error downloading file: {e}")
            return {"status": "error", "message": str(e)}, 500


@frida_namespace.route('/pull')
class FridaPull(Resource):
    def post(self):
        try:
            data = request.get_json()
            device_id = data.get("device_id")
            pid = int(data.get("pid"))
            os_type = data.get("os_type")
            print(f"Device ID: {device_id}, PID: {pid}, OS Type: {os_type}")

            if not all([device_id, pid, os_type]):
                return {"status": "error", "message": "Missing required parameters"}, 400

            device = require_mobile_device(frida.get_device_manager().get_device(device_id))

            if not device:
                if device_id.startswith("socket@"):
                    host, port = device_id.split('@')[1].split(':')
                    device = frida.get_device_manager().add_remote_device(f"{host}:{port}")
                else:
                    return {"status": "error", "message": "Device not found and unable to reconnect"}, 404

            # Enhanced process discovery for Android APK extraction
            print(f"Looking for process with PID {pid} on device {device_id}")
            
            # Try to find in applications first (running apps with metadata)
            applications = device.enumerate_applications(scope='metadata')
            target_app = next((app for app in applications if app.pid == pid), None)

            identifier = None
            process_name = None
            
            if target_app:
                identifier = target_app.identifier
                process_name = target_app.name
                print(f"Found target app: {process_name} (package: {identifier})")
            else:
                # If not found in applications, check running processes
                processes = device.enumerate_processes()
                target_process = next((proc for proc in processes if proc.pid == pid), None)
                if not target_process:
                    return {"status": "error", "message": f"Process with PID {pid} not found on device"}, 404
                
                process_name = target_process.name
                # For Android, try to derive package name from process name
                if os_type.lower() == "android":
                    # Use process name as identifier for Android, the script will handle package discovery
                    identifier = target_process.name
                    print(f"Found target process: {process_name} (will resolve package name dynamically)")
                else:
                    identifier = target_process.name
                    print(f"Found target process: {process_name}")

            if not identifier:
                return {"status": "error", "message": "Could not determine process identifier"}, 400

            print(f"Target Identifier: {identifier}, Process Name: {process_name}")
            
            # Additional validation for Android
            if os_type.lower() == "android":
                print("Performing Android-specific validations...")
                try:
                    # Verify we can attach to the process
                    test_session = device.attach(pid)
                    test_session.detach()
                    print("Process attachment test successful")
                except Exception as e:
                    return {"status": "error", "message": f"Cannot attach to process {pid}: {str(e)}"}, 403

            session = device.attach(pid)
            print(f"Successfully attached to process {pid}")

            # Choose the appropriate script based on OS type
            if os_type.lower() == "android":
                script_content = self.get_android_script(identifier)
            elif os_type.lower() == "ios":
                script_content = self.get_ios_script(identifier)
            else:
                script_content = self.get_default_script(identifier)

            script = session.create_script(script_content)

            file_content = b""
            file_size = 0
            script_completed = False
            error_message = None
            file_type = "binary"  # Default type

            def on_message(message, data):
                nonlocal file_content, file_size, script_completed, error_message, file_type
                if message['type'] == 'send':
                    payload = message['payload']
                    if payload['type'] == 'file_start':
                        file_size = payload['size']
                        if 'fileType' in payload:
                            file_type = payload['fileType']
                        print(f"Starting to pull {identifier} as {file_type}, total size: {file_size} bytes")
                    elif payload['type'] == 'chunk':
                        chunk = base64.b64decode(payload['data'])
                        file_content += chunk
                        print(f"Received chunk, total received: {len(file_content)} bytes")
                    elif payload['type'] == 'file_complete':
                        print(f"Completed pulling {identifier}, total size: {len(file_content)} bytes")
                    elif payload['type'] == 'error':
                        error_message = payload['message']
                        print(f"Error: {error_message}")
                    elif payload['type'] == 'all_complete':
                        script_completed = True
                elif message['type'] == 'error':
                    error_message = message['description']
                    print(f"Script error: {error_message}")

            script.on('message', on_message)
            script.load()

            # Wait for the script to complete or timeout
            timeout = 600  # 10 minutes timeout for larger APK files
            start_time = time.time()
            last_progress_time = start_time
            
            print(f"Waiting for script completion (timeout: {timeout}s)...")
            while not script_completed and time.time() - start_time < timeout:
                time.sleep(0.5)
                current_time = time.time()
                
                # Log progress every 30 seconds
                if current_time - last_progress_time >= 30:
                    elapsed = current_time - start_time
                    if file_content:
                        print(f"Progress after {elapsed:.1f}s: received {len(file_content)} bytes")
                    else:
                        print(f"Waiting {elapsed:.1f}s - no data received yet...")
                    last_progress_time = current_time

            elapsed_total = time.time() - start_time
            print(f"Script execution completed after {elapsed_total:.1f}s")

            if not script_completed:
                error_msg = f"Script execution timed out after {timeout}s"
                if file_content:
                    error_msg += f" (received {len(file_content)} bytes before timeout)"
                return {"status": "error", "message": error_msg}, 500

            if error_message:
                return {"status": "error", "message": f"Script error: {error_message}"}, 500

            if not file_content:
                return {"status": "error", "message": "No file content received from script"}, 500
            
            print(f"Successfully received {len(file_content)} bytes, file type: {file_type}")

            # Save the file content with appropriate extension
            file_extension = f".{file_type}"  # This is correct, but we need to ensure proper handling in FridaDownload
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
                temp_file.write(file_content)
                saved_file_path = temp_file.name

            # Generate download ID and store file info
            download_id = str(uuid4())
            download_cache[download_id] = {
                'path': saved_file_path,
                'identifier': identifier,
                'file_type': file_type
            }

            return jsonify({
                "status": "success",
                "file_type": file_type.upper(),
                "file": {identifier: saved_file_path},
                "download_id": download_id
            })

        except frida.ServerNotRunningError:
            return {"status": "error", "message": "Frida server is not running on the device"}, 503
        except frida.TransportError as e:
            return {"status": "error", "message": f"Transport error: {str(e)}"}, 500
        except Exception as e:
            logger.exception(f"Error pulling file: {e}")
            return {"status": "error", "message": str(e)}, 500
        finally:
            if 'session' in locals():
                session.detach()

    def get_android_script(self, identifier):
        """Returns a Frida script specifically for Android APK extraction with improved package detection"""
        script_template = """
        try {{
           // Base64 encode implementation for binary files
           function base64Encode(data) {{
               var base64Table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
               var result = '';
               var pad = '';
               var length = data.length;
               var remaining = length % 3;

               if (remaining === 1) {{
                   pad = '==';
               }} else if (remaining === 2) {{
                   pad = '=';
               }}

               for (var i = 0; i < length - remaining; i += 3) {{
                   var chunk = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
                   result += base64Table[(chunk >> 18) & 63];
                   result += base64Table[(chunk >> 12) & 63];
                   result += base64Table[(chunk >> 6) & 63];
                   result += base64Table[chunk & 63];
               }}

               if (remaining === 1) {{
                   var chunk = data[length - 1];
                   result += base64Table[(chunk >> 2) & 63];
                   result += base64Table[(chunk << 4) & 63];
                   result += pad;
               }} else if (remaining === 2) {{
                   var chunk = (data[length - 2] << 8) | data[length - 1];
                   result += base64Table[(chunk >> 10) & 63];
                   result += base64Table[(chunk >> 4) & 63];
                   result += base64Table[(chunk << 2) & 63];
                   result += pad;
               }}

               return result;
           }}
           
           console.log("Attempting to pull APK for process: {identifier}");
           
           if (Java.available) {{
               Java.perform(function () {{
                   var targetIdentifier = '{identifier}';
                   
                   function getPackageManager() {{
                       try {{
                           var ActivityThread = Java.use('android.app.ActivityThread');
                           var currentApplication = ActivityThread.currentApplication();
                           if (currentApplication !== null) {{
                               return currentApplication.getPackageManager();
                           }}
                           var context = ActivityThread.getSystemContext();
                           return context.getPackageManager();
                       }} catch (e) {{
                           throw new Error("Error getting PackageManager: " + e);
                       }}
                   }}
                   
                   function findPackageNameByPid(pid) {{
                       try {{
                           var ActivityManager = Java.use("android.app.ActivityManager");
                           var ActivityThread = Java.use('android.app.ActivityThread');
                           var currentApplication = ActivityThread.currentApplication();
                           var context = currentApplication || ActivityThread.getSystemContext();
                           
                           var activityManager = context.getSystemService("activity");
                           var runningProcesses = activityManager.getRunningAppProcesses();
                           
                           if (runningProcesses && runningProcesses.size() > 0) {{
                               for (var i = 0; i < runningProcesses.size(); i++) {{
                                   var processInfo = runningProcesses.get(i);
                                   if (processInfo.pid.value === pid) {{
                                       return processInfo.processName.value;
                                   }}
                               }}
                           }}
                           return null;
                       }} catch (e) {{
                           console.log("Error finding package by PID: " + e);
                           return null;
                       }}
                   }}
                   
                   function getApkPath(packageName) {{
                       try {{
                           var packageManager = getPackageManager();
                           if (!packageManager) {{
                               throw new Error("Failed to get PackageManager");
                           }}

                           var packageInfo = packageManager.getPackageInfo(packageName, 0);
                           if (!packageInfo) {{
                               throw new Error("Failed to get PackageInfo for " + packageName);
                           }}

                           var apkPath = packageInfo.applicationInfo.value.sourceDir.value;
                           if (!apkPath) {{
                               throw new Error("Failed to get APK path for " + packageName);
                           }}
                           
                           return apkPath;
                       }} catch (e) {{
                           throw new Error("Error getting APK path for " + packageName + ": " + e);
                       }}
                   }}

                   try {{
                       var packageName = targetIdentifier;
                       var currentPid = Process.id;
                       
                       console.log("Target identifier: " + targetIdentifier);
                       console.log("Current PID: " + currentPid);
                       
                       var apkPath = null;
                       
                       // Method 1: Try identifier as package name directly
                       try {{
                           console.log("Method 1: Trying identifier as package name: " + packageName);
                           apkPath = getApkPath(packageName);
                           console.log("Success! APK found using identifier as package name: " + apkPath);
                       }} catch (e) {{
                           console.log("Method 1 failed: " + e);
                           
                           // Method 2: Find package name by current PID
                           try {{
                               console.log("Method 2: Finding package name by PID");
                               var foundPackageName = findPackageNameByPid(currentPid);
                               if (foundPackageName) {{
                                   console.log("Found package name by PID: " + foundPackageName);
                                   packageName = foundPackageName;
                                   apkPath = getApkPath(packageName);
                                   console.log("Success! APK found using PID lookup: " + apkPath);
                               }} else {{
                                   throw new Error("Could not find package name by PID");
                               }}
                           }} catch (e2) {{
                               console.log("Method 2 failed: " + e2);
                               
                               // Method 3: Try common package name patterns
                               console.log("Method 3: Trying common package patterns");
                               var possiblePackages = [
                                   targetIdentifier,
                                   "com." + targetIdentifier,
                                   "com.android." + targetIdentifier,
                                   targetIdentifier.toLowerCase(),
                                   "com." + targetIdentifier.toLowerCase()
                               ];
                               
                               var found = false;
                               for (var j = 0; j < possiblePackages.length && !found; j++) {{
                                   try {{
                                       console.log("Trying pattern: " + possiblePackages[j]);
                                       apkPath = getApkPath(possiblePackages[j]);
                                       packageName = possiblePackages[j];
                                       console.log("Success! APK found using pattern: " + packageName + " -> " + apkPath);
                                       found = true;
                                   }} catch (innerE) {{
                                       console.log("Pattern failed: " + possiblePackages[j] + " - " + innerE);
                                   }}
                               }}
                               
                               if (!found) {{
                                   throw new Error("All methods failed to find APK");
                               }}
                           }}
                       }}
                       
                       if (!apkPath) {{
                           throw new Error("Could not determine APK path for: " + targetIdentifier + ". Package may not be installed or accessible.");
                       }}

                       console.log("Final package name: " + packageName);
                       console.log("Final APK path: " + apkPath);

                       var File = Java.use("java.io.File");
                       var FileInputStream = Java.use("java.io.FileInputStream");
                       var Base64 = Java.use("android.util.Base64");

                       var file = File.$new(apkPath);
                       if (!file.exists()) {{
                           throw new Error("APK file does not exist at path: " + apkPath);
                       }}
                       
                       var fileSize = file.length();
                       console.log("APK file size: " + fileSize + " bytes");

                       send({{type: "file_start", size: fileSize, fileType: "apk"}});

                       var inputStream = FileInputStream.$new(file);
                       var chunkSize = 1024 * 1024; // 1MB chunks
                       var buffer = Java.array('byte', new Array(chunkSize).fill(0));
                       var bytesRead;
                       var totalBytesRead = 0;

                       console.log("Starting APK transfer...");
                       while ((bytesRead = inputStream.read(buffer, 0, chunkSize)) !== -1) {{
                           var chunk;
                           if (bytesRead < chunkSize) {{
                               chunk = Java.array('byte', Array.from(buffer).slice(0, bytesRead));
                           }} else {{
                               chunk = buffer;
                           }}
                           
                           var base64Chunk = Base64.encodeToString(chunk, Base64.NO_WRAP.value);
                           send({{type: "chunk", data: base64Chunk}});
                           
                           totalBytesRead += bytesRead;
                           if (totalBytesRead % (10 * 1024 * 1024) === 0 || totalBytesRead === fileSize) {{
                               console.log("Progress: " + totalBytesRead + "/" + fileSize + " bytes (" + Math.round((totalBytesRead/fileSize)*100) + "%)");
                           }}
                       }}

                       inputStream.close();
                       console.log("Successfully transferred complete APK file: " + totalBytesRead + " bytes");
                       send({{type: "file_complete"}});
                   }} catch (e) {{
                       var errorMsg = "Error processing APK for " + targetIdentifier + ": " + e.toString();
                       if (e.stack) {{
                           errorMsg += "\\nStack: " + e.stack;
                       }}
                       console.log(errorMsg);
                       send({{type: "error", message: errorMsg}});
                   }}
                   send({{type: "all_complete"}});
               }});
           }}
           else {{
               send({{type: "error", message: "Java environment not available on this device"}});
               send({{type: "all_complete"}});
           }}
        }} catch (e) {{
           send({{type: "error", message: e.toString()}});
           console.log(e.stack);
        }}
        """
        return script_template.format(identifier=identifier)

    def get_ios_script(self, identifier):
        """Returns a Frida script for iOS binary decryption with improved binary detection and verification"""
        return """
        try {
            // Utility functions
            function log(message) {
                console.log(message);
                send({
                    type: "log",
                    message: message
                });
            }

            // Helper function to read uint8 array as hex string
            function bytesToHexString(bytes, start, length) {
                var hex = "";
                for (var i = start; i < start + length && i < bytes.length; i++) {
                    var b = bytes[i].toString(16);
                    if (b.length === 1) b = "0" + b;
                    hex += b;
                }
                return hex;
            }

            // Binary decryption for both 32-bit and 64-bit
            function decryptBinary() {
                log("[*] Starting binary decryption process...");

                try {
                    // Get app info
                    var NSBundle = ObjC.classes.NSBundle;
                    var mainBundle = NSBundle.mainBundle();
                    var bundlePath = mainBundle.bundlePath().toString();
                    var executableName = mainBundle.infoDictionary().objectForKey_('CFBundleExecutable').toString();
                    var executablePath = bundlePath + '/' + executableName;
                    var bundleID = mainBundle.bundleIdentifier().toString();

                    log("[*] App bundle path: " + bundlePath);
                    log("[*] Executable path: " + executablePath);

                    // Step 1: Read the original binary file
                    var NSFileManager = ObjC.classes.NSFileManager;
                    var NSData = ObjC.classes.NSData;
                    var fileManager = NSFileManager.defaultManager();

                    var decryptedPath = "/tmp/" + executableName + ".decrypted";
                    log("[*] Reading original binary: " + executablePath);

                    var fileData = NSData.dataWithContentsOfFile_(executablePath);
                    if (!fileData) {
                        throw new Error("Failed to read original binary file");
                    }

                    var fileSize = fileData.length();
                    log("[+] Original binary size: " + fileSize + " bytes");

                    // Step 2: Create a byte array from the file
                    log("[*] Creating working copy of binary...");
                    var fileBytes = Memory.readByteArray(fileData.bytes(), fileData.length());
                    var fileBuffer = new Uint8Array(fileBytes);

                    // Step 3: Determine binary format by examining file header
                    log("[*] Examining file header...");

                    // Log first 16 bytes for debugging
                    var headerBytes = bytesToHexString(fileBuffer, 0, 16);
                    log("[+] File header (first 16 bytes): " + headerBytes);

                    // Check for Mach-O signatures
                    var is64Bit = false;
                    var isLittleEndian = false;

                    // 32-bit little-endian: cefaedfe
                    if (headerBytes.substring(0, 8) === "cefaedfe") {
                        log("[+] Detected 32-bit little-endian Mach-O");
                        is64Bit = false;
                        isLittleEndian = true;
                    }
                    // 32-bit big-endian: feedface
                    else if (headerBytes.substring(0, 8) === "feedface") {
                        log("[+] Detected 32-bit big-endian Mach-O");
                        is64Bit = false;
                        isLittleEndian = false;
                    }
                    // 64-bit little-endian: cffaedfe
                    else if (headerBytes.substring(0, 8) === "cffaedfe") {
                        log("[+] Detected 64-bit little-endian Mach-O");
                        is64Bit = true;
                        isLittleEndian = true;
                    }
                    // 64-bit big-endian: feedfacf
                    else if (headerBytes.substring(0, 8) === "feedfacf") {
                        log("[+] Detected 64-bit big-endian Mach-O");
                        is64Bit = true;
                        isLittleEndian = false;
                    }
                    else {
                        throw new Error("Not a valid Mach-O binary (header: " + headerBytes + ")");
                    }

                    // Helper function to read uint32 based on endianness
                    function readUInt32(buffer, offset) {
                        if (isLittleEndian) {
                            return (buffer[offset] & 0xFF) | 
                                   ((buffer[offset + 1] & 0xFF) << 8) | 
                                   ((buffer[offset + 2] & 0xFF) << 16) | 
                                   ((buffer[offset + 3] & 0xFF) << 24);
                        } else {
                            return ((buffer[offset] & 0xFF) << 24) | 
                                   ((buffer[offset + 1] & 0xFF) << 16) | 
                                   ((buffer[offset + 2] & 0xFF) << 8) | 
                                   (buffer[offset + 3] & 0xFF);
                        }
                    }

                    // Step 4: Parse Mach-O header
                    const headerSize = is64Bit ? 32 : 28;
                    const ncmds = readUInt32(fileBuffer, 16);
                    const sizeofcmds = readUInt32(fileBuffer, 20);

                    log("[+] Number of load commands: " + ncmds);
                    log("[+] Size of load commands: " + sizeofcmds + " bytes");

                    // Step 5: Find encryption info in load commands
                    log("[*] Searching for encryption info...");

                    // Constants for load commands
                    const LC_ENCRYPTION_INFO = 0x21;
                    const LC_ENCRYPTION_INFO_64 = 0x2C;

                    let offset = headerSize;
                    let foundEncryption = false;
                    let cryptoff = 0;
                    let cryptsize = 0;
                    let cryptid = 0;
                    let cryptidOffset = 0;

                    for (let i = 0; i < ncmds; i++) {
                        const cmd = readUInt32(fileBuffer, offset);
                        const cmdsize = readUInt32(fileBuffer, offset + 4);

                        log("[*] Command " + i + ": 0x" + cmd.toString(16) + ", size: " + cmdsize);

                        // Check for both 32-bit and 64-bit encryption info commands
                        if ((is64Bit && cmd === LC_ENCRYPTION_INFO_64) || (!is64Bit && cmd === LC_ENCRYPTION_INFO)) {
                            log("[+] Found encryption info at offset: 0x" + offset.toString(16));
                            log("[+] Command type: " + (is64Bit ? "LC_ENCRYPTION_INFO_64" : "LC_ENCRYPTION_INFO"));

                            cryptoff = readUInt32(fileBuffer, offset + 8);
                            cryptsize = readUInt32(fileBuffer, offset + 12);
                            cryptid = readUInt32(fileBuffer, offset + 16);
                            cryptidOffset = offset + 16;

                            log("[+] Encryption details:");
                            log("    - cryptoff: 0x" + cryptoff.toString(16) + " (" + cryptoff + " bytes)");
                            log("    - cryptsize: 0x" + cryptsize.toString(16) + " (" + cryptsize + " bytes)");
                            log("    - cryptid: " + cryptid + (cryptid === 0 ? " (Not encrypted)" : " (Encrypted)"));

                            foundEncryption = true;
                            break;
                        }

                        offset += cmdsize;
                    }

                    if (!foundEncryption) {
                        throw new Error("No encryption info found in binary");
                    }

                    if (cryptid === 0) {
                        log("[!] Binary is already marked as not encrypted");
                    }

                    // Step 6: Get the memory-mapped module
                    log("[*] Getting module information...");
                    var mainModule = Process.getModuleByName(executableName);
                    log("[+] Module base address: " + mainModule.base);
                    log("[+] Module size: " + mainModule.size);

                    // Step 7: Extract the decrypted section from memory
                    log("[*] Extracting decrypted section from memory...");

                    // LLDB approach: memory read --force --outfile extractedbin --binary --count <cryptsize> <dynamic offset>+<cryptoff>
                    var encryptedSectionMemAddr = mainModule.base.add(cryptoff);
                    log("[+] Encrypted section memory address: " + encryptedSectionMemAddr);

                    // Read the decrypted data from memory
                    var decryptedSection = Memory.readByteArray(encryptedSectionMemAddr, cryptsize);

                    if (!decryptedSection || decryptedSection.byteLength === 0) {
                        throw new Error("Failed to read decrypted section from memory");
                    }

                    log("[+] Successfully read decrypted section from memory: " + decryptedSection.byteLength + " bytes");

                    // Step 8: Replace the encrypted section in our file buffer
                    log("[*] Replacing encrypted section with decrypted data...");

                    var decryptedData = new Uint8Array(decryptedSection);
                    for (let i = 0; i < cryptsize; i++) {
                        fileBuffer[cryptoff + i] = decryptedData[i];
                    }

                    log("[+] Replaced encrypted section with decrypted data");

                    // Step 9: Set cryptid to 0
                    log("[*] Setting cryptid to 0...");
                    if (isLittleEndian) {
                        fileBuffer[cryptidOffset] = 0;
                        fileBuffer[cryptidOffset + 1] = 0;
                        fileBuffer[cryptidOffset + 2] = 0;
                        fileBuffer[cryptidOffset + 3] = 0;
                    } else {
                        fileBuffer[cryptidOffset] = 0;
                        fileBuffer[cryptidOffset + 1] = 0;
                        fileBuffer[cryptidOffset + 2] = 0;
                        fileBuffer[cryptidOffset + 3] = 0;
                    }

                    log("[+] Set cryptid to 0");

                    // Step 10: Write the patched binary to disk
                    log("[*] Writing decrypted binary to: " + decryptedPath);

                    var outputBuffer = Memory.alloc(fileBuffer.length);
                    Memory.writeByteArray(outputBuffer, fileBuffer);
                    var outputData = NSData.dataWithBytes_length_(outputBuffer, fileBuffer.length);

                    var success = outputData.writeToFile_atomically_(decryptedPath, true);

                    if (!success) {
                        throw new Error("Failed to write decrypted binary to disk");
                    }

                    log("[+] Successfully wrote decrypted binary");

                    // Set executable permissions
                    var NSNumber = ObjC.classes.NSNumber;
                    var NSDictionary = ObjC.classes.NSDictionary;

                    var attrs = NSDictionary.dictionaryWithObject_forKey_(
                        NSNumber.numberWithInteger_(0x1ed), // 0755 octal
                        "NSFilePosixPermissions"
                    );

                    fileManager.setAttributes_ofItemAtPath_error_(attrs, decryptedPath, NULL);

                    log("[+] Set executable permissions");

                    // Step 11: Create IPA with decrypted binary
                    createDecryptedIPA(bundlePath, executableName, decryptedPath, bundleID);

                    return true;
                } catch (e) {
                    log("[-] Error in binary decryption: " + e.toString());
                    if (e.stack) {
                        log(e.stack);
                    }
                    return false;
                }
            }

            // Create IPA structure (same as before)
            function createDecryptedIPA(bundlePath, executableName, decryptedBinaryPath, bundleID) {
                log("[*] Preparing decrypted IPA structure...");

                try {
                    var NSFileManager = ObjC.classes.NSFileManager;
                    var fileManager = NSFileManager.defaultManager();

                    // Create IPA directory structure
                    var ipaDir = "/tmp/decrypted_" + bundleID;
                    var payloadDir = ipaDir + "/Payload";
                    var appDir = payloadDir + "/" + executableName + ".app";

                    log("[*] Creating IPA directory structure at: " + ipaDir);

                    // Remove old directory if exists
                    if (fileManager.fileExistsAtPath_(ipaDir)) {
                        fileManager.removeItemAtPath_error_(ipaDir, NULL);
                    }

                    // Create directories
                    fileManager.createDirectoryAtPath_withIntermediateDirectories_attributes_error_(
                        ipaDir, true, NULL, NULL);
                    fileManager.createDirectoryAtPath_withIntermediateDirectories_attributes_error_(
                        payloadDir, true, NULL, NULL);

                    // Copy the entire app bundle
                    log("[*] Copying app bundle to: " + appDir);
                    fileManager.copyItemAtPath_toPath_error_(bundlePath, appDir, NULL);

                    // Replace the binary with the decrypted version
                    var targetBinaryPath = appDir + "/" + executableName;

                    log("[*] Replacing binary with decrypted version");
                    if (fileManager.fileExistsAtPath_(targetBinaryPath)) {
                        fileManager.removeItemAtPath_error_(targetBinaryPath, NULL);
                    }

                    fileManager.copyItemAtPath_toPath_error_(decryptedBinaryPath, targetBinaryPath, NULL);

                    // Set proper permissions
                    var NSNumber = ObjC.classes.NSNumber;
                    var NSDictionary = ObjC.classes.NSDictionary;

                    var attrs = NSDictionary.dictionaryWithObject_forKey_(
                        NSNumber.numberWithInteger_(0x1ed), // 0755 octal
                        "NSFilePosixPermissions"
                    );

                    fileManager.setAttributes_ofItemAtPath_error_(attrs, targetBinaryPath, NULL);

                    log("[+] Successfully prepared decrypted IPA structure");
                    log("[*] IPA directory: " + ipaDir);
                    log("[*] To create IPA: cd " + ipaDir + " && zip -r ../decrypted_" + bundleID + ".ipa Payload/");

                    // Optional: Remove some unnecessary files to reduce IPA size
                    try {
                        var codeSigPath = appDir + "/_CodeSignature";
                        var scInfoPath = appDir + "/SC_Info";

                        if (fileManager.fileExistsAtPath_(codeSigPath)) {
                            log("[*] Removing _CodeSignature directory...");
                            fileManager.removeItemAtPath_error_(codeSigPath, NULL);
                        }

                        if (fileManager.fileExistsAtPath_(scInfoPath)) {
                            log("[*] Removing SC_Info directory...");
                            fileManager.removeItemAtPath_error_(scInfoPath, NULL);
                        }
                    } catch (e) {
                        log("[-] Error cleaning up IPA: " + e.toString());
                    }

                    // Notify completion
                    send({
                        type: "ipa_prepared",
                        path: ipaDir
                    });

                    return true;
                } catch (e) {
                    log("[-] Error preparing IPA: " + e.toString());
                    if (e.stack) {
                        log(e.stack);
                    }
                    return false;
                }
            }

            // Main execution
            if (ObjC.available) {
                log("[*] Starting iOS binary decryption...");

                // Wait for app to fully initialize
                setTimeout(function() {
                    log("[*] App should be fully loaded now, proceeding with decryption...");
                    decryptBinary();
                    send({type: "all_complete"});
                }, 2000);
            } else {
                log("[-] Objective-C runtime not available");
                send({
                    type: "error", 
                    message: "Objective-C environment not available on this device"
                });
                send({type: "all_complete"});
            }
        } catch (e) {
            console.log("Error: " + e.toString());
            send({
                type: "error", 
                message: e.toString()
            });
            send({type: "all_complete"});
        }
        """

    def get_default_script(self, identifier):
        """Returns a Frida script for generic binary extraction"""
        return """
        try {
           // Base64 encode implementation for binary files
           function base64Encode(data) {
               var base64Table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
               var result = '';
               var pad = '';
               var length = data.length;
               var remaining = length % 3;

               if (remaining === 1) {
                   pad = '==';
               } else if (remaining === 2) {
                   pad = '=';
               }

               for (var i = 0; i < length - remaining; i += 3) {
                   var chunk = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
                   result += base64Table[(chunk >> 18) & 63];
                   result += base64Table[(chunk >> 12) & 63];
                   result += base64Table[(chunk >> 6) & 63];
                   result += base64Table[chunk & 63];
               }

               if (remaining === 1) {
                   var chunk = data[length - 1];
                   result += base64Table[(chunk >> 2) & 63];
                   result += base64Table[(chunk << 4) & 63];
                   result += pad;
               } else if (remaining === 2) {
                   var chunk = (data[length - 2] << 8) | data[length - 1];
                   result += base64Table[(chunk >> 10) & 63];
                   result += base64Table[(chunk >> 4) & 63];
                   result += base64Table[(chunk << 2) & 63];
                   result += pad;
               }

               return result;
           }

           // Binary case
           try {
               console.log("Reading binary file");
               var mainModule = Process.mainModule;
               console.log("Main module:", JSON.stringify(mainModule));

               send({type: "file_start", size: mainModule.size, fileType: "binary"});

               // Read binary data directly from memory
               var data = Memory.readByteArray(mainModule.base, mainModule.size);
               var uint8Array = new Uint8Array(data);

               // Send data in chunks
               var chunkSize = 1024 * 1024; // 1MB chunks
               for (var i = 0; i < uint8Array.length; i += chunkSize) {
                   var chunk = uint8Array.slice(i, Math.min(i + chunkSize, uint8Array.length));
                   send({type: "chunk", data: base64Encode(Array.from(chunk))});
               }

               send({type: "file_complete"});
               send({type: "all_complete"});
           } catch (e) {
               send({type: "error", message: "Error reading binary: " + e.toString() + "\\n" + e.stack});
               console.log(e.stack);
           }
        } catch (e) {
           send({type: "error", message: e.toString()});
           console.log(e.stack);
        }
        """
