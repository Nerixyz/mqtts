import { assertPacket, assertWritePacket } from '../../test/utilities';
import {
    PublishReceivedPacket,
    readPublishReceivedPacket,
    writePublishReceivedPacket,
} from './publish.received.packet';
import { PacketStream } from '../packet-stream';
import { assert } from 'chai';

describe('PublishReceivedPacket', function () {
    describe('readPublishReceivedPacket', function () {
        it('should read properly', function () {
            assertPacket(
                readPublishReceivedPacket(PacketStream.fromHex('000a'), 2),
                PublishReceivedPacket,
                new PublishReceivedPacket(10),
            );
        });
        it('should fail on invalid remaining length', function () {
            assert.throws(() => readPublishReceivedPacket(PacketStream.fromHex('0a'), 1));
        });
    });
    describe('writePublishReceivedPacket', function () {
        it('should write', function () {
            assertWritePacket(writePublishReceivedPacket, { identifier: 10 }, { identifier: 10 }, '000a');
        });
    });
});