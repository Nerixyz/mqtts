import { Transport } from './transport';
import { WebSocket, ClientOptions, createWebSocketStream } from 'ws';
import { Duplex } from 'stream';
import { IllegalStateError } from '../errors';

export interface WebsocketTransportOptions {
    url: string;
    additionalOptions?: ClientOptions;
    protocols?: string | string[];
}

export class WebsocketTransport extends Transport<WebsocketTransportOptions> {
    public duplex?: Duplex;
    private socket?: WebSocket;

    constructor(options: WebsocketTransportOptions) {
        super(options);
        this.reset();
    }

    reset() {
        if (this.socket) this.socket.close();

        if (this.duplex && !this.duplex.destroyed) this.duplex.destroy();

        this.socket = undefined;
        this.duplex = undefined;
    }

    connect(): Promise<void> {
        if (this.socket || this.duplex) throw new IllegalStateError('WebSocket still connected.');

        this.socket = new WebSocket(this.options.url, this.options.protocols, this.options.additionalOptions);
        this.duplex = createWebSocketStream(this.socket, { objectMode: true });
        const socket = this.socket;
        const duplex = this.duplex;
        return new Promise((resolve, reject) => {
            socket.once('open', () => {
                resolve();
                duplex.removeAllListeners('error');
            });
            duplex.once('error', e => {
                reject(e);
                socket.removeAllListeners('open');
            });
        });
    }
}
