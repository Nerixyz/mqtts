import { writeDisconnectRequestPacket } from './disconnect.request.packet';
import { assertWritePacket } from '../../test/utilities';

describe('DisconnectRequestPacket', function() {
    it('should write nothing', function() {
        assertWritePacket(writeDisconnectRequestPacket, {}, {});
    })
})