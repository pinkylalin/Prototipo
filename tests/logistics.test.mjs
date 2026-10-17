import test from 'node:test';
import assert from 'node:assert/strict';
import '../app.js';
const { calculate, seed, addDays, confirmTravelParty, normalizeRecords } = globalThis.TransportDemo;
const day = '2026-10-16';
const journey = (changes = {}) => ({ id: 'one', patientName: 'Paciente', companionName: 'Acompañante', departureDate: addDays(day, -1), appointmentDate: day, patientStatus: 'return', companionStatus: 'return', patientReturnDate: day, companionReturnDate: day, ...changes });

test('Ejemplo: 16 de ida, 21 confirmados, 3 pendientes, 2 unidades', () => {
  assert.deepEqual(calculate(seed(day), day), { outbound: 16, confirmed: 21, pending: 3, staying: 4, overdue: 0, outboundUnits: 1, units: 2, extraUnits: 1 });
});
test('Paciente internado y acompañante regresa: un asiento', () => {
  const result = calculate([journey({ patientStatus: 'stay', patientReturnDate: null })], day);
  assert.equal(result.confirmed, 1); assert.equal(result.staying, 1);
});
test('Ambos permanecen: ningún asiento de regreso', () => {
  const result = calculate([journey({ patientStatus: 'stay', companionStatus: 'stay' })], day);
  assert.equal(result.units, 0); assert.equal(result.staying, 2);
});
test('Regresos de días anteriores se suman y completados no se vuelven a contar', () => {
  const previous = journey({ patientReturnDate: addDays(day, -3), companionStatus: 'returned' });
  const result = calculate([previous], day);
  assert.equal(result.confirmed, 1); assert.equal(result.overdue, 1);
});
test('Alta posterior: entra al cálculo en la fecha indicada', () => {
  const record = journey({ patientReturnDate: addDays(day, 2), companionStatus: 'returned' });
  assert.equal(calculate([record], day).confirmed, 0);
  assert.equal(calculate([record], addDays(day, 2)).confirmed, 1);
});
test('Capacidad: 16 personas caben en una; 17 requieren dos', () => {
  const records = Array.from({ length: 17 }, () => journey({ companionName: null }));
  assert.equal(calculate(records.slice(0, 16), day).units, 1);
  assert.equal(calculate(records, day).units, 2);
});
test('La ida manda si necesita más unidades que el regreso', () => {
  const records = Array.from({ length: 17 }, () => journey({ companionName: null, departureDate: day, appointmentDate: addDays(day, 1), patientStatus: 'pending', patientReturnDate: addDays(day, 1) }));
  const result = calculate(records, day);
  assert.equal(result.units, 2); assert.equal(result.pending, 0); assert.equal(result.extraUnits, 0);
});
test('Cero personas: cero unidades', () => assert.equal(calculate([], day).units, 0));

test('No se registra la salida sin confirmar si viaja solo o acompañado', () => {
  assert.throws(() => confirmTravelParty(journey(), undefined), /Confirma si el paciente/);
  assert.throws(() => confirmTravelParty(journey(), 'accompanied', '  '), /nombre del acompañante/);
});
test('Confirmar viaje solo elimina al acompañante de la ida y el regreso', () => {
  const record = confirmTravelParty(journey({ departureDate: day }), 'solo', 'Nombre anterior');
  assert.equal(record.travelPartyConfirmed, true);
  assert.equal(record.companionName, '');
  assert.equal(record.companionStatus, null);
  assert.equal(record.companionReturnDate, null);
  const result = calculate([record], day);
  assert.equal(result.outbound, 1); assert.equal(result.confirmed, 1);
});
test('Confirmar un acompañante adicional reserva su asiento y mantiene el estado del paciente', () => {
  const solo = journey({ departureDate: day, companionName: '', companionStatus: null, companionReturnDate: null });
  const record = confirmTravelParty(solo, 'accompanied', ' Ana Pérez ');
  assert.equal(record.companionName, 'Ana Pérez');
  assert.equal(record.companionStatus, 'pending');
  assert.equal(record.patientStatus, 'return');
  const result = calculate([record], day);
  assert.equal(result.outbound, 2); assert.equal(result.confirmed, 1); assert.equal(result.pending, 1);
});
test('Actualizar la confirmación no pierde el estado de un acompañante que permanece en B', () => {
  const record = confirmTravelParty(journey({ companionStatus: 'stay', companionReturnDate: null }), 'accompanied', 'Acompañante');
  assert.equal(record.companionStatus, 'stay'); assert.equal(record.companionReturnDate, null);
});
test('Los registros anteriores se conservan y no inventan una confirmación del paciente', () => {
  const [record] = normalizeRecords([journey()]);
  assert.equal(record.patientName, 'Paciente'); assert.equal(record.companionName, 'Acompañante');
  assert.equal(record.travelParty, 'accompanied'); assert.equal(record.travelPartyConfirmed, false);
});

test('Al agregar pasajeros a la ida, la recomendación aumenta al superar 32 asientos', () => {
  const records = seed(day);
  const outbound = journey({ companionName: '', departureDate: day, appointmentDate: addDays(day, 1), patientStatus: 'pending', patientReturnDate: addDays(day, 1) });
  for (let i = 0; i < 16; i++) records.push({ ...outbound, id: 'outbound-' + i });
  assert.equal(calculate(records, day).outbound, 32);
  assert.equal(calculate(records, day).units, 2);
  records.push({ ...outbound, id: 'outbound-17' });
  assert.equal(calculate(records, day).outbound, 33);
  assert.equal(calculate(records, day).units, 3);
  assert.equal(calculate(records, addDays(day, -1)).outbound, 16);
});
test('Más regresos guardados también aumentan unidades aunque la ida siga en 16 personas', () => {
  const records = seed(day);
  for (let i = 0; i < 9; i++) records.push(journey({ id: 'return-' + i, companionName: '' }));
  const result = calculate(records, day);
  assert.equal(result.outbound, 16); assert.equal(result.confirmed + result.pending, 33);
  assert.equal(result.units, 3); assert.equal(result.extraUnits, 2);
});
