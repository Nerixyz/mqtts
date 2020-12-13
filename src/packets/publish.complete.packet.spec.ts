import { assertPacket, assertWritePacket } from '../../test/utilities';
import { PacketStream } from '../packet-stream';
import { assert } from 'chai';
import {
    PublishCompletePacket,
    readPublishCompletePacket,
    writePublishCompletePacket,
} from './publish.complete.packet';

describe('PublishCompletePacket', function () {
    describe('readPublishCompletePacket', function () {
        it('should read properly', function () {
            assertPacket(
                readPublishCompletePacket(PacketStream.fromHex('000a'), 2),
                PublishCompletePacket,
                new PublishCompletePacket(10),
            );
        });
        it('should fail on invalid remaining length', function () {
            assert.throws(() => readPublishCompletePacket(PacketStream.fromHex('0a'), 1));
        });
    });
    describe('writePublishCompletePacket', function () {
        it('should write', function () {
            assertWritePacket(writePublishCompletePacket, { identifier: 10 }, { identifier: 10 }, '000a');
        });
    });
});
