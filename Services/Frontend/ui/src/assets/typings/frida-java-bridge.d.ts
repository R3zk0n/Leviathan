/**
 * Frida Java Bridge - Android Runtime Type Definitions
 * Based on frida-java-bridge for advanced Android instrumentation
 */

declare namespace Java {
  /**
   * Get current Android API level
   * @returns API level number (e.g., 30 for Android 11)
   */
  function getAndroidApiLevel(): number;

  /**
   * Get Android version string
   * @returns Version string (e.g., "11")
   */
  function getAndroidVersion(): string;

  /**
   * Get ART API interface
   */
  function getApi(): any;

  /**
   * Generate backtrace from current location
   * @returns Backtrace string
   */
  function backtrace(): string;

  /**
   * Deoptimize the entire boot image
   */
  function deoptimizeBootImage(): void;

  /**
   * Deoptimize all methods in the runtime
   */
  function deoptimizeEverything(): void;

  /**
   * Deoptimize a specific method
   * @param method - The method to deoptimize
   */
  function deoptimizeMethod(method: any): void;

  /**
   * Ensure a class is initialized
   * @param className - Fully qualified class name
   */
  function ensureClassInitialized(className: string): void;

  /**
   * Revert all global patches applied by Frida
   */
  function revertGlobalPatches(): void;

  /**
   * Translate method for execution
   * @param method - The method to translate
   */
  function translateMethod(method: any): void;

  /**
   * Execute callback with all ART threads suspended
   * @param callback - Function to execute
   */
  function withAllArtThreadsSuspended(callback: () => void): void;

  /**
   * Execute callback with a runnable ART thread
   * @param callback - Function to execute
   */
  function withRunnableArtThread(callback: () => void): void;

  /**
   * ART Method representation
   */
  interface ArtMethod {
    prettyMethod(): string;
    toString(): string;
  }

  /**
   * ART Stack Visitor for walking stack frames
   */
  interface ArtStackVisitor {
    walkStack(includeTransitions: boolean): void;
  }

  /**
   * Handle vector for managing object references
   */
  interface HandleVector {
    size(): number;
    get(index: number): any;
  }

  /**
   * Variable sized handle scope for managing handles
   */
  interface VariableSizedHandleScope {
    capacity(): number;
  }
}

declare namespace Android {
  /**
   * Get ART class specification
   */
  function getArtClassSpec(): any;

  /**
   * Get ART field specification
   */
  function getArtFieldSpec(): any;

  /**
   * Get ART method specification
   */
  function getArtMethodSpec(): any;

  /**
   * Get ART thread specification
   */
  function getArtThreadSpec(): any;

  /**
   * Get ART thread from JNI environment
   * @param env - JNI environment pointer
   */
  function getArtThreadFromEnv(env: NativePointer): any;

  /**
   * Create class loader visitor
   * @param callback - Visitor callback function
   */
  function makeArtClassLoaderVisitor(callback: (classLoader: any) => void): any;

  /**
   * Create class visitor
   * @param callback - Visitor callback function
   */
  function makeArtClassVisitor(callback: (klass: any) => void): any;

  /**
   * Create method name mangler
   */
  function makeMethodMangler(): any;

  /**
   * Create object visitor predicate
   * @param callback - Predicate callback
   */
  function makeObjectVisitorPredicate(callback: (obj: any) => boolean): any;
}
