import { hardWareData } from "./hardwareservice.js";

const wait = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

async function connectWithRetry(device, retries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await device.gatt.connect();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await wait(600 * attempt);
    }
  }
  throw new Error("Could not establish a Bluetooth connection.", { cause: lastError });
}

export async function connectToBluetooth(onPacket) {
  if (!navigator.bluetooth) {
    throw new Error("Web Bluetooth is not supported in this browser.");
  }

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: ["battery_service"],
  });
  const server = await connectWithRetry(device);
  const hardwareInfo = await hardWareData(server);
  const datapacks = [];
  const cleanupCallbacks = [];
  let notificationCount = 0;

  for (const [serviceUuid, serviceCharacteristics] of Object.entries(hardwareInfo)) {
    for (const [characteristicUuid, info] of Object.entries(serviceCharacteristics)) {
      const { characteristic, properties } = info;
      if (!properties.notify && !properties.indicate) continue;

      const handleNotification = (event) => {
        const value = event.target.value;
        const bytes = Array.from({ length: value.byteLength }, (_, index) => value.getUint8(index));
        const packet = { serviceUuid, characteristicUuid, bytes, timestamp: Date.now() };
        datapacks.push(packet);
        onPacket?.(packet);
      };

      await characteristic.startNotifications();
      characteristic.addEventListener("characteristicvaluechanged", handleNotification);
      cleanupCallbacks.push(() => characteristic.removeEventListener("characteristicvaluechanged", handleNotification));
      notificationCount += 1;
    }
  }

  return {
    device,
    server,
    hardwareInfo,
    notificationCount,
    datapacks,
    cleanup: () => cleanupCallbacks.forEach((cleanup) => cleanup()),
  };
}
