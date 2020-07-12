import { assertPacket, assertWritePacket } from '../../test/utilities';
import { PacketStream } from '../packet-stream';
import { PublishAckPacket, readPublishAckPacket, writePublishAckPacket } from './publish.ack.packet';
import { assert } from 'chai';

describe('PublishAckPacket', function () {
    describe('readPublishAckPacket', function () {
        it('should read properly', function () {
            assertPacket(
                readPublishAckPacket(PacketStream.fromHex('000a'), 2),
                PublishAckPacket,
                new PublishAckPacket(10),
            );
        });
        it('should fail on invalid remaining length', function () {
            assert.throws(() => readPublishAckPacket(PacketStream.fromHex('0a'), 1));
        });
    });
    describe('writePublishAckPacket', function () {
        it('should write', function () {
            assertWritePacket(writePublishAckPacket, { identifier: 10 }, { identifier: 10 }, '000a');
        });
    });
});
