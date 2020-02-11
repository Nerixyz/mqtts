import { Transport } from './transport';
import * as URL from 'url';
import { Socket, connect } from 'net';

export class TcpTransport extends Transport<{ url: string; enableTrace?: boolean }> {
    private socket: Socket;
    send(data: Buffer): void {
        this.socket.write(data);
    }

    connect(): void {
        const url = URL.parse(this.options.url);
        this.socket = connect({
            host: url.hostname ?? '',
            port: Number(url.port),
            timeout: 0,
        });
        this.socket.on('error', e => this.callbacks.error(e));
        this.socket.on('end', () => this.callbacks.disconnect());
        this.socket.on('close', () => this.callbacks.disconnect());
        this.socket.on('connect', () => this.callbacks.connect());
        this.socket.on('timeout', () => this.callbacks.disconnect());
        this.socket.on('data', res => this.callbacks.data(res));
    }
}
