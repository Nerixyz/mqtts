import { Transport } from './transport';
import { TLSSocket, connect } from 'tls';
import * as URL from 'url';
import { SocksClient, SocksProxy } from 'socks';

export class TlsTransport extends Transport<{
    url: string; enableTrace?: boolean; proxyOptions?: TlsTransportProxyOptions
}> {
    private socket: TLSSocket;
    send(data: Buffer): void {
        this.socket.write(data);
    }

    async connect(): Promise<any> {
        const url = URL.parse(this.options.url);
        const host = url.hostname ?? '';
        const port = Number(url.port);
        let proxySocket;
        if (this.options.proxyOptions !== undefined) {
            const info = await SocksClient.createConnection({
                proxy: this.options.proxyOptions,
                command: 'connect',
                destination: {
                    host,
                    port,
                }
            });
            proxySocket = info.socket;
        }
        this.socket = connect({
            socket: proxySocket,
            host,
            port,
            enableTrace: !!this.options.enableTrace,
            timeout: 0,
        });
        this.socket.on('error', e => this.callbacks.error(e));
        this.socket.on('end', () => this.callbacks.disconnect());
        this.socket.on('close', () => this.callbacks.disconnect());
        this.socket.on('secureConnect', () => this.callbacks.connect());
        this.socket.on('timeout', () => this.callbacks.disconnect());
        this.socket.on('data', res => this.callbacks.data(res));
    }

    disconnect(): void {
        this.socket.removeAllListeners('close');
        this.socket.end();
    }
}

export type TlsTransportProxyOptions = SocksProxy;
