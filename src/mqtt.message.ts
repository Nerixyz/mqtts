export interface MqttMessage {
    topic: string;
    payload: Buffer;
    retained?: boolean;
    duplicate?: boolean;
    qosLevel?: number;
}

export interface MqttMessageOutgoing {
    topic: string;
    retained?: boolean;
    duplicate?: boolean;
    qosLevel?: number;
    payload: Buffer | string;
}
