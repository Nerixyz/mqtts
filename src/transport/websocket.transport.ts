import { Transport } from './transport';
import * as WebSocket from 'ws';
import { ClientOptions } from 'ws';
import { Duplex, PassThrough } from 'stream';
import duplexify = require('duplexify');

export interface WebsocketTransportOptions {
    url: string;
    additionalOptions?: ClientOptions;
}

export class WebsocketTransport extends Transport<WebsocketTransportOptions> {
    // this will be set on the constructor
    public duplex!: Duplex;
    private socket?: WebSocket;
    private socketStream?: Duplex;
    private readonly readable = new PassThrough();
    private readonly writable = new PassThrough();

    constructor(options: WebsocketTransportOptions) {
        super(options);
        this.reset();
    }

    reset() {
        this.duplex = duplexify(this.writable, this.readable, {objectMode: true});
    }


    connect(): Promise<void> {
        this.socket = new WebSocket(this.options.url, this.options.additionalOptions);
        this.socketStream = WebSocket.createWebSocketStream(this.socket, {objectMode: true});
        this.socketStream.pipe(this.readable);
        this.writable.pipe(this.socketStream);

        return new Promise(resolve => this.socket?.on('open', resolve));
    }
}
