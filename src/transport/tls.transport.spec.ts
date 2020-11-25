import { assertTransportConnectsAndDisconnects } from '../../test/utilities';
import { TlsTransport } from './tls.transport';

describe('TlsTransport', function () {
    it('should connect and disconnect', async function () {
        await assertTransportConnectsAndDisconnects(
            new TlsTransport({
                host: 'broker.emqx.io',
                port: 8883,
                additionalOptions: {
                    // prev. 'test.mosquitto.org'
                    // this server uses a self signed cert
                    // rejectUnauthorized: false,
                },
            }),
        );
    });
});
