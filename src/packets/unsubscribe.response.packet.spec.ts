import { assertPacket } from '../../test/utilities';
import { readUnsubscribePacket, UnsubscribeResponsePacket } from './unsubscribe.response.packet';
import { PacketStream } from '../packet-stream';
import { assert } from 'chai';

describe('UnsubscribeResponsePacket', function () {
    describe('readUnsubscribeResponsePacket', function () {
        it('should read the packet', function () {
            assertPacket(
                readUnsubscribePacket(PacketStream.fromHex('0001'), 2),
                UnsubscribeResponsePacket,
                new UnsubscribeResponsePacket(1),
            );
        });
        it('should throw on invalid remaining length', function () {
            assert.throws(() => readUnsubscribePacket(PacketStream.fromHex('0001'), 3));
        });
    });
});
