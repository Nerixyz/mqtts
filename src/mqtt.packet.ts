import { PacketStream } from './packet-stream';
import { nullOrUndefined } from './mqtt.utilities';

export abstract class MqttPacket {
    public get packetType(): number {
        return this._packetType;
    }
    public set identifier(value: number | null) {
        if (this.hasIdentifier) {
            this._identifier = Math.max(Math.min(value ?? 0, 0xffff), 0);
        }
    }
    public get identifier(): number | null {
        return this.hasIdentifier ? this._identifier : null;
    }

    protected get hasIdentifier(): boolean {
        return false;
    }
    protected get inlineIdentifier(): boolean {
        return false;
    }

    private readonly _packetType: number;
    protected packetFlags = 0;
    protected remainingPacketLength = 0;
    private _identifier: number;

    private static nextId = 0;

    protected generateIdentifier() {
        if (nullOrUndefined(this._identifier)) {
            this._identifier = MqttPacket.generateIdentifier();
        }
        return this._identifier;
    }

    public static generateIdentifier(): number {
        MqttPacket.nextId++;
        MqttPacket.nextId &= 0xffff;
        return MqttPacket.nextId;
    }

    protected constructor(packetType: number) {
        this._packetType = packetType;
    }

    public read(stream: PacketStream): void {
        const typeAndFlags = stream.readByte();
        const type = (typeAndFlags & 0xf0) >> 4;
        const flags = typeAndFlags & 0x0f;
        if (type !== this._packetType) {
            throw new Error('Invalid packet type');
        }

        this.packetFlags = flags;
        this.readRemainingLength(stream);
        if (this.hasIdentifier && !this.inlineIdentifier) {
            this.readIdentifier(stream);
        }
    }

    protected readIdentifier(stream: PacketStream): PacketStream {
        if (this.hasIdentifier) this._identifier = stream.readWord();
        return stream;
    }

    public write(stream: PacketStream): void {
        stream.writeByte(((this._packetType & 0x0f) << 4) | (this.packetFlags & 0x0f));
        if (this.hasIdentifier && !this.inlineIdentifier) this.remainingPacketLength += 2;
        this.writeRemainingLength(stream);
        if (this.hasIdentifier && !this.inlineIdentifier) this.writeIdentifier(stream);
    }

    protected writeIdentifier(stream: PacketStream): PacketStream {
        if (this.hasIdentifier) stream.writeWord(this._identifier ?? this.generateIdentifier());
        return stream;
    }

    private readRemainingLength(stream: PacketStream): void {
        this.remainingPacketLength = 0;
        let multiplier = 1;

        let encodedByte;
        do {
            encodedByte = stream.readByte();

            this.remainingPacketLength += (encodedByte & 0x7f) * multiplier;
            if (multiplier > 128 * 128 * 128) {
                throw new Error(`Invalid length @${stream.position}/${stream.length}; currentLength: ${this.remainingPacketLength}`);
            }
            multiplier *= 0x80;
        } while ((encodedByte & 0x80) !== 0);
    }

    private writeRemainingLength(stream: PacketStream): void {
        let num = this.remainingPacketLength;
        let digit = 0;
        do {
            digit = num % 128 | 0;
            num = (num / 128) | 0;
            if (num > 0) digit = digit | 0x80;

            stream.writeByte(digit);
        } while (num > 0);
    }

    protected assertValidStringLength(str: string): void {
        if (str.length > 0xffff) {
            throw new Error(`The string ${str.substring(0, 20)} is longer than 0xffff bytes.`);
        }
    }

    protected assertValidString(str: string): void {
        this.assertValidStringLength(str);
        /* eslint no-control-regex: "off" */
        if (str.match(/[\xD8-\xDF][\x00-\xFF]|\x00\x00/) !== null) {
            throw new Error(`The string ${str.substring(0, 20)} contains invalid characters`);
        }
    }

    protected assertValidQosLevel(level: number): void {
        if (level < 0 || level > 2) {
            throw new Error(`Invalid QoS level ${level}.`);
        }
    }

    public toString(): string {
        const stream = PacketStream.empty();

        return stream.data.toString('utf8');
    }
}
