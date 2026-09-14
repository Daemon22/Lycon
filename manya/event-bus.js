import { EventFabric, createEvent } from '@manya-os/nervous-system';

/**
 * Lycon's compatibility facade for the published Manya event fabric.
 * It keeps the adapter's stable envelope while using EventFabric underneath.
 */
export function createBus(options = {}) {
  const fabric = new EventFabric({
    recordByDefault: options.replay === true,
  });
  fabric._publish = (topic, payload) => {
    const event = createEvent(topic, payload.sourceToolId || 'lycon-browser', payload);
    const delivered = fabric.publish(event);
    return {
      delivered,
      eventId: `evt-${event.id.replace(/-/g, '').slice(0, 12)}`,
      publishedAt: new Date(event.timestamp).toISOString(),
    };
  };

  fabric._subscribeLegacy = (topic, handler) => {
    const id = fabric.subscribe({ topic }, (event) => {
      const payload = event.payload;
      handler({
        eventId: `evt-${event.id.replace(/-/g, '').slice(0, 12)}`,
        topic: event.topic,
        type: payload?.type || 'generic',
        sourceToolId: payload?.sourceToolId || event.source,
        payload,
        publishedAt: new Date(event.timestamp).toISOString(),
      });
    });
    return id;
  };

  return fabric;
}

export function subscribe(bus, topic, handler) {
  if (!bus || typeof bus._subscribeLegacy !== 'function') {
    throw new TypeError('subscribe requires a Lycon event bus');
  }
  return bus._subscribeLegacy(topic, handler);
}
