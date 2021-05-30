import { assertTransportConnectsAndDisconnects } from '../../test/utilities';
import { WebsocketTransport } from './websocket.transport';

describe('WebsocketTransport', function () {
    it('should connect and disconnect without SSL', async function () {
        await assertTransportConnectsAndDisconnects(new WebsocketTransport({ url: 'ws://test.mosquitto.org:8080' }));
    });
    it('should connect and disconnect with SSL', async function () {
        await assertTransportConnectsAndDisconnects(new WebsocketTransport({ url: 'wss://test.mosquitto.org:8081' }));
    });
});
