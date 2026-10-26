-- Sample only. This query is read-only and uses fictional table names.
WITH RecentOrders AS (
    SELECT
        o.OrderId,
        o.CustomerId,
        o.OrderDate,
        o.TotalAmount,
        ROW_NUMBER() OVER (
            PARTITION BY o.CustomerId
            ORDER BY o.OrderDate DESC, o.OrderId DESC
        ) AS RowNumber
    FROM dbo.Orders AS o
    WHERE o.OrderDate >= DATEADD(DAY, -90, GETDATE())
      AND o.Status IN ('PAID', 'SHIPPED')
),
CustomerSummary AS (
    SELECT
        c.CustomerId,
        CONCAT(c.FirstName, ' ', c.LastName) AS CustomerName,
        COUNT(ro.OrderId) AS RecentOrderCount,
        SUM(COALESCE(ro.TotalAmount, 0)) AS RecentSpend
    FROM dbo.Customers AS c
    LEFT JOIN RecentOrders AS ro
        ON ro.CustomerId = c.CustomerId
       AND ro.RowNumber <= 5
    WHERE c.IsActive = 1
    GROUP BY c.CustomerId, c.FirstName, c.LastName
)
SELECT
    cs.CustomerId,
    cs.CustomerName,
    cs.RecentOrderCount,
    cs.RecentSpend,
    CASE
        WHEN cs.RecentSpend >= 1000 THEN 'High; value'
        WHEN cs.RecentSpend >= 250 THEN 'Medium'
        ELSE 'Low'
    END AS SpendTier
FROM CustomerSummary AS cs
WHERE cs.RecentOrderCount > 0
ORDER BY cs.RecentSpend DESC, cs.CustomerId;
