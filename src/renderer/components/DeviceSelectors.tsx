import { useEffect, useState } from "react";
import type { DisplaySourceDescriptor } from "@shared/types/ipc";
import { useI18n } from "@renderer/i18n/useI18n";

interface MediaDeviceState {
  microphones: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
  cameras: MediaDeviceInfo[];
  displays: DisplaySourceDescriptor[];
}

interface DeviceSelectorsProps {
  inputDeviceId: string;
  outputDeviceId: string;
  cameraDeviceId: string;
  screenSourceId: string;
  disabled?: boolean;
  onInputChange: (value: string) => void;
  onOutputChange: (value: string) => void;
  onCameraChange: (value: string) => void;
  onScreenChange: (value: string) => void;
}

export function DeviceSelectors(props: DeviceSelectorsProps) {
  const { copy } = useI18n();
  const [devices, setDevices] = useState<MediaDeviceState>({
    microphones: [],
    speakers: [],
    cameras: [],
    displays: []
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [mediaDevices, displays] = await Promise.all([
        navigator.mediaDevices.enumerateDevices(),
        window.appApi.media.listDisplaySources()
      ]);
      if (cancelled) {
        return;
      }

      setDevices({
        microphones: mediaDevices.filter((item) => item.kind === "audioinput"),
        speakers: mediaDevices.filter((item) => item.kind === "audiooutput"),
        cameras: mediaDevices.filter((item) => item.kind === "videoinput"),
        displays
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="panel selectors">
      <div className="panel-title">{copy.deviceSelectors.title}</div>
      <label>
        {copy.deviceSelectors.microphone}
        <select
          value={props.inputDeviceId}
          disabled={props.disabled}
          onChange={(event) => props.onInputChange(event.target.value)}
        >
          <option value="">{copy.common.defaultOption}</option>
          {devices.microphones.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || device.deviceId}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.deviceSelectors.output}
        <select
          value={props.outputDeviceId}
          disabled={props.disabled}
          onChange={(event) => props.onOutputChange(event.target.value)}
        >
          <option value="">{copy.common.defaultOption}</option>
          {devices.speakers.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || device.deviceId}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.deviceSelectors.camera}
        <select
          value={props.cameraDeviceId}
          disabled={props.disabled}
          onChange={(event) => props.onCameraChange(event.target.value)}
        >
          <option value="">{copy.common.defaultOption}</option>
          {devices.cameras.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || device.deviceId}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.deviceSelectors.screenSource}
        <select
          value={props.screenSourceId}
          disabled={props.disabled}
          onChange={(event) => props.onScreenChange(event.target.value)}
        >
          <option value="">{copy.deviceSelectors.selectSource}</option>
          {devices.displays.map((display) => (
            <option key={display.id} value={display.id}>
              {copy.deviceSelectors.displayKind[display.kind]}: {display.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
