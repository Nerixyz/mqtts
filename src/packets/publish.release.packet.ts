import { PacketTypes } from '../mqtt.constants';
import { MqttPacket } from '../mqtt.packet';

export class PublishReleasePacket extends MqttPacket {
    get hasIdentifier(): boolean {
        return true;
    }

    public constructor(identifier?: number) {
        super(PacketTypes.TYPE_PUBREL);
        this.packetFlags = 2;
        this.identifier = identifier ?? MqttPacket.generateIdentifier();
    }
}
