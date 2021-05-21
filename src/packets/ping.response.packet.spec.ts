import { assertPacket, assertWritePacket } from '../../test/utilities';
import { PacketStream } from '../packet-stream';
import { PingResponsePacket, readPingResponsePacket, writePingResponsePacket } from './ping.response.packet';
import { assert } from 'chai';

describe('PingResponsePacket', function () {
    it('should write nothing', function () {
        assertWritePacket(writePingResponsePacket, {}, {});
    });
    it('should read', function () {
        assertPacket(readPingResponsePacket(PacketStream.empty(), 0), PingResponsePacket, new PingResponsePacket());
    });
    it('should fail on length != 0', function () {
        assert.throws(() => readPingResponsePacket(PacketStream.empty(), 1));
    });
});
