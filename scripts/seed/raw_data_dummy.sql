INSERT INTO tb_raw_data (batch_date, integration_id, tenant_id, collector_id, parse_yn, data)
SELECT batch_date, integration_id, tenant_id, collector_id, parse_yn, data
FROM (VALUES
  ('2026-07-01', 'JSM', 1, 1, 'Y', '{"issues":[{"id":"JSM-101","title":"Login page broken","status":"Open","priority":"High"},{"id":"JSM-102","title":"Export button missing","status":"In Progress","priority":"Medium"}],"total":2}'),
  ('2026-07-01', 'SAP', 1, 2, 'N', '{"orders":[{"orderId":"ORD-9901","amount":15200,"currency":"USD","status":"PENDING"},{"orderId":"ORD-9902","amount":8750,"currency":"USD","status":"COMPLETE"}],"total":2}'),
  ('2026-07-01', 'SNOW', 1, 3, 'Y', '{"incidents":[{"number":"INC0001234","short_description":"VPN not connecting","state":"In Progress","urgency":"1"},{"number":"INC0001235","short_description":"Printer offline","state":"New","urgency":"3"}],"count":2}'),
  ('2026-06-30', 'JSM', 1, 1, 'Y', '{"issues":[{"id":"JSM-099","title":"Dashboard load slow","status":"Resolved","priority":"Low"}],"total":1}'),
  ('2026-06-30', 'SAP', 1, 2, 'Y', '{"orders":[{"orderId":"ORD-9890","amount":22000,"currency":"USD","status":"COMPLETE"}],"total":1}')
) AS v(batch_date, integration_id, tenant_id, collector_id, parse_yn, data)
WHERE (SELECT COUNT(*) FROM tb_raw_data) = 0;

SELECT id, batch_date, integration_id, tenant_id, parse_yn FROM tb_raw_data ORDER BY id;
