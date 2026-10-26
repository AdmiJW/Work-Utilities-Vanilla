-- Sample only. One-line should emit one physical line for each statement.
SELECT CustomerId, AccountStatus
FROM dbo.Customer
WHERE AccountStatus = 'ACTIVE';

SELECT OrderNo, TotalAmount, Currency
FROM dbo.PurchaseOrder
WHERE CustomerId = 'CUS-1001'
  AND OrderStatus IN ('PENDING', 'REVIEW');

SELECT RequestId, RequestStatus
FROM dbo.RefundRequest
WHERE RequestStatus = 'OPEN';
