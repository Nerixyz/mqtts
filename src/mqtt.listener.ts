import { MqttMessage } from './mqtt.message';
import { IncomingListenMessage } from './mqtt.types';
import { extractParams, matchTopic } from './mqtt.utilities';

export class MqttListener {
    private handlers: Array<HandlerInfo<any, any>> = [];

    public handleMessage(message: MqttMessage) {
        return Promise.all(
            this.handlers
                .filter(h => matchTopic(h.topicFilter, message.topic))
                .map(async handler => {
                    const params = handler.paramMatcher ? extractParams(handler.paramMatcher, message.topic) : {};
                    if (handler.validator && !handler.validator(message, params)) return;

                    const finalMessage = {
                        ...message,
                        params,
                    };
                    handler.handle(handler.transformer ? await handler.transformer(finalMessage) : finalMessage);
                }),
        );
    }

    public addHandler<T, Params extends Record<string, string>>(handler: HandlerInfo<T, Params>): RemoveHandlerFn {
        this.handlers.push(handler);
        return () => (this.handlers = this.handlers.filter(x => x !== handler));
    }
}

export type RemoveHandlerFn = () => void;
export type HandlerFn<T = MessageWithParams> = (message: T) => void;
export type ValidatorFn<Params extends Record<string, string>> = (message: MqttMessage, params: Params) => boolean;
export type TransformerFn<TOut, Params extends Record<string, string>> = (
    message: IncomingListenMessage<Params>,
) => TOut | Promise<TOut>;

export type MessageWithParams<T extends Record<string, string> = Record<string, string>> = MqttMessage & {params: T};

export interface HandlerInfo<T, Params extends Record<string, string>> {
    topicFilter: string;
    paramMatcher?: string;
    validator?: ValidatorFn<Params>;
    transformer?: TransformerFn<T, Params>;
    handle: HandlerFn<T>;
}
