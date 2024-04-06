import { MqttClient, TcpTransport, MessageWithParams } from 'mqtts';

const client = new MqttClient({
    // there are multiple transports for example WebSocket and TLS you may provide your own transport
    transport: new TcpTransport({ host: 'broker.hivemq.com', port: 1883 }),
    autoReconnect: true,
});

await client.connect();

// subscribe and listen to a topic with params
await client.listenSubscribe(
    '/mqtts/test/:param',
    async ({ params, payload }: MessageWithParams<{ param: string }>) => {
        await client.publish({
            topic: '/mqtts/pong',
            payload: JSON.stringify({ param: params.param, data: payload.toString() }),
        });
    },
);
