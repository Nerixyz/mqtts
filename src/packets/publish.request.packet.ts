import { PacketTypes } from '../mqtt.constants';
import { PacketStream } from '../packet-stream';
import { MqttPacket } from '../mqtt.packet';
import { EndOfStreamError } from '../errors';

export class PublishRequestPacket extends MqttPacket {
    public get payload(): Buffer {
        return this._payload;
    }
    public get topic(): string {
        return this._topic;
    }

    public set topic(value: string) {
        this.assertValidString(value);
        this._topic = value;
    }

    public get duplicate(): boolean {
        return (this.packetFlags & 8) === 8;
    }

    public set duplicate(val: boolean) {
        if (val) {
            this.packetFlags |= 8;
        } else {
            this.packetFlags &= ~8;
        }
    }

    public get retained(): boolean {
        return (this.packetFlags & 1) === 1;
    }

    public set retained(val: boolean) {
        if (val) {
            this.packetFlags |= 1;
        } else {
            this.packetFlags &= ~1;
        }
    }

    public get qosLevel(): number {
        return (this.packetFlags & 6) >> 1;
    }

    public set qosLevel(val: number) {
        this.assertValidQosLevel(val);
        this.packetFlags |= (val & 3) << 1;
    }

    get hasIdentifier(): boolean {
        return !!this.qosLevel;
    }

    protected get inlineIdentifier(): boolean {
        return true;
    }

    private _topic: string;
    private _payload: Buffer;

    public constructor(topic?: string, payload?: Buffer | string | undefined, qos?: number) {
        super(PacketTypes.TYPE_PUBLISH);
        this._topic = topic ?? '';
        this._payload = payload ? (payload instanceof Buffer ? payload : Buffer.from(payload)) : Buffer.from([]);
        this.qosLevel = qos ?? 0;
    }

    read(stream: PacketStream): void {
        super.read(stream);
        const lastPos = stream.position;
        this._topic = stream.readString();
        this.readIdentifier(stream);

        const payloadLength = this.remainingPacketLength - (stream.position - lastPos);
        if (payloadLength === 0) return;
        if (payloadLength > stream.length - stream.position) throw new EndOfStreamError();

        this._payload = stream.read(payloadLength);
    }

    public write(stream: PacketStream): void {
        const data = this.writeIdentifier(PacketStream.empty().writeString(this._topic)).write(this._payload);

        this.remainingPacketLength = data.length;
        super.write(stream);
        stream.write(data.data);
    }
}
