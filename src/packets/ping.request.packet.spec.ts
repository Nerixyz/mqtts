import { writePingRequestPacket, readPingRequestPacket, PingRequestPacket } from './ping.request.packet';
import { PacketStream } from '../packet-stream';
import { assertWritePacket, assertPacket } from '../../test/utilities';
import { assert } from 'chai';

describe('PingRequestPacket', function () {
    it('should write nothing', function () {
        assertWritePacket(writePingRequestPacket, {}, {});
    });
    it('should read', function () {
        assertPacket(readPingRequestPacket(PacketStream.empty(), 0), PingRequestPacket, new PingRequestPacket());
    });
    it('should fail on length != 0', function () {
        assert.throws(() => readPingRequestPacket(PacketStream.empty(), 1));
    });
});