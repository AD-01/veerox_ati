import { DomainEvent } from './index';
class TestEvent extends DomainEvent {}
describe('DomainEvent', () => {
  it('should initialize timestamp', () => {
    const ev = new TestEvent();
    expect(ev.occurredOn).toBeInstanceOf(Date);
  });
});
