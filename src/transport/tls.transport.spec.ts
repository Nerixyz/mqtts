import { assertTransportConnectsAndDisconnects } from '../../test/utilities';
import { TlsTransport } from './tls.transport';

describe('TlsTransport', function () {
    it('should connect and disconnect', async function () {
        await assertTransportConnectsAndDisconnects(
            new TlsTransport({
                host: 'test.mosquitto.org',
                port: 8883,
                additionalOptions: {
                    // this server uses a self signed cert
                    rejectUnauthorized: false,
                },
            }),
        );
    });
});
