import { PacketTypes } from '../mqtt.constants';
import { PacketStream } from '../packet-stream';
import { MqttPacket } from '../mqtt.packet';
import { InvalidDirectionError } from '../errors';

export class UnsubscribeRequestPacket extends MqttPacket {
    get hasIdentifier(): boolean {
        return true;
    }

    public get topic(): string {
        return this._topic;
    }

    public set topic(value: string) {
        this.assertValidString(value);
        this._topic = value;
    }

    private _topic: string;

    public constructor(topic?: string) {
        super(PacketTypes.TYPE_UNSUBSCRIBE);
        this.packetFlags = 2;
        this.assertValidString(topic ?? '');
        this._topic = topic ?? '';
    }

    public read(): void {
        throw new InvalidDirectionError('read');
    }

    public write(stream: PacketStream): void {
        const data = PacketStream.empty().writeString(this._topic);
        this._remainingPacketLength = data.length;
        super.write(stream);
        stream.write(data.data);
    }
}
