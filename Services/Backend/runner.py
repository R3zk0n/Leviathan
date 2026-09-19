import frida
import json
import time

# === Connect to remote device ===
device = frida.get_device_manager().add_remote_device("192.168.0.169:1111")

# === Attach to target process ===
session = device.attach(2585)  # Replace with actual PID

# === Load your Frida agent ===
with open("./_agent.js", "r", encoding="utf-8") as f:
    script_source = f.read()

script = session.create_script(script_source)

# === Log handler ===
def on_message(message, data):
    if message["type"] == "send":
        payload = message["payload"]
        if isinstance(payload, dict) and payload.get("type") == "log":
            level = payload.get("level", "info")
            log_msg = payload.get("message")
            print(f"[{level.upper()}] {log_msg}")
        else:
            print(f"[SEND] {payload}")
    elif message["type"] == "error":
        print("[ERROR]", message["stack"])

script.on("message", on_message)

# === Load the script ===
print("[*] Loading script...")
script.load()
print("[+] Script loaded successfully")

# === Call getFridaVersion using _rpc_request ===
try:
    result = script._rpc_request({
        "type": "call",
        "payload": {
            "method": "getFridaVersion",  # Use the exported camelCase method
            "params": []
        }
    })
    print("[+] frida_version:", result)
except Exception as e:
    print("[-] Failed to call getFridaVersion:", str(e))

# === Keep the process alive to receive logs ===
print("[*] Listening for logs... Press Ctrl+C to exit.")
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("\n[!] Exiting.")
