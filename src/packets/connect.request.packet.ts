import { MqttPacket } from '../mqtt.packet';
import { PacketTypes } from '../mqtt.constants';
import { PacketStream } from '../packet-stream';
import { MqttMessage } from '../mqtt.message';
import { defaults, random } from 'lodash';
import { InvalidDirectionError } from '../errors';

export class ConnectRequestPacket extends MqttPacket {
    public options: ConnectRequestOptions;

    public constructor(options?: ConnectRequestOptions) {
        super(PacketTypes.TYPE_CONNECT);

        this.options = defaults(options, {
            protocolLevel: 4,
            protocolName: 'MQTT',
            flags: ConnectRequestPacket.makeFlags(options),
            clientId: 'mqtts_' + random(0, 200000),
            keepAlive: 60,
        });
    }

    private static makeFlags(options?: ConnectRequestOptions): number {
        if (!options) return 0;

        let flags = 0;
        if (options.username) flags |= 0x1 << 7;
        if (options.password) flags |= 0x1 << 6;
        if (options.will) {
            if (options.will.retained) flags |= 0x1 << 5;

            flags |= ((options.will.qosLevel ?? 0) & 0x03) << 3;
            flags |= 0x1 << 2;
        }
        if (options.clean) flags |= 0x1 << 1;

        return flags;
    }

    public write(stream: PacketStream): void {
        const { protocolLevel, protocolName, flags, clientId, keepAlive, will, username, password } = this.options;
        const data = PacketStream.empty()
            .writeString(protocolName ?? 'MQTT')
            .writeByte(protocolLevel ?? 4)
            .writeByte(flags ?? ConnectRequestPacket.makeFlags(this.options))
            .writeWord(keepAlive ?? 60)
            .writeString(clientId ?? 'mqtt_' + random(0, 200000));

        if (will) data.writeString(will.topic).writeString(will.payload.toString());
        if (username) data.writeString(username);
        if (password) data.writeString(password);
        this.remainingPacketLength = data.length;
        super.write(stream);

        stream.write(data.data);
    }

    public read(): void {
        throw new InvalidDirectionError('read');
    }
}

export interface ConnectRequestOptions {
    protocolLevel?: number;
    protocolName?: string;
    flags?: number;
    clientId?: string;
    keepAlive?: number;
    will?: MqttMessage;
    username?: string;
    password?: string;
    clean?: boolean;
}
