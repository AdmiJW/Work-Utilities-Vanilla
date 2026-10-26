-- Sample only. Shape the selected values as one pipe-delimited output column.
SELECT
    CONCAT_WS(
        '|',
        CAST(c.CustomerId AS varchar(20)),
        c.Email,
        c.DisplayName,
        c.AccountStatus,
        CONVERT(varchar(33), c.DateTimeCreated, 127),
        (
            SELECT
                c.CustomerId AS customerId,
                c.AccountStatus AS status,
                c.ProfileJson AS profile
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        )
    ) AS OutputRow
FROM dbo.Customer AS c WITH (NOLOCK)
WHERE c.CustomerId IN ('CUS-1001', 'CUS-1002')
ORDER BY c.CustomerId;
