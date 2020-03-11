import { PacketTypes } from '../mqtt.constants';
import { PacketStream } from '../packet-stream';
import { MqttPacket } from '../mqtt.packet';
import { InvalidDirectionError } from '../errors';

export class SubscribeRequestPacket extends MqttPacket {
    get hasIdentifier(): boolean {
        return true;
    }

    public get qosLevel(): number {
        return this._qosLevel;
    }

    public set qosLevel(value: number) {
        this.assertValidQosLevel(value);
        this._qosLevel = value;
    }
    public get topic(): string {
        return this._topic;
    }

    public set topic(value: string) {
        this.assertValidString(value);
        this._topic = value;
    }

    private _topic: string;
    private _qosLevel: number;

    public constructor(topic?: string, qosLevel = 1) {
        super(PacketTypes.TYPE_SUBSCRIBE);
        this.assertValidQosLevel(qosLevel);
        this.assertValidString(topic ?? '');
        this._topic = topic ?? '';
        this._qosLevel = qosLevel;
        this.packetFlags = 2;
    }

    public read(): void {
        throw new InvalidDirectionError('read');
    }

    public write(stream: PacketStream): void {
        const data = PacketStream.empty()
            .writeString(this._topic)
            .writeByte(this._qosLevel);
        this._remainingPacketLength = data.length;
        super.write(stream);
        stream.write(data.data);
    }
}
