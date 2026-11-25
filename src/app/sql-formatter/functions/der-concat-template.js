export const derConcatTemplate = `DECLARE @COLUMNS NVARCHAR(MAX) = '';
DECLARE @TableName NVARCHAR(MAX) = '';
DECLARE @ByRefTax BIT = 0; -- Set to 1 (true) or 0 (false)
\u0020
-- Add IdentifierNumber at the start if @ByRefTax is 1
IF @ByRefTax = 1
BEGIN
    -- Use TEI1 alias for tables that have additional joins, otherwise use the original table name
    IF @TableName IN ('RefTaxEntityRelationship', 'PropertyRelationship')
    BEGIN
        SET @COLUMNS = 'TEI1.IdentifierNumber , ''|'' , ';
        SET @COLUMNS = @COLUMNS + 'TEI2.IdentifierNumber , ''|'' , ';
    END
    ELSE
    BEGIN
        SET @COLUMNS = 'IdentifierNumber , ''|'' , ';
    END
END
\u0020
-- Determine the join column based on table name
DECLARE @JoinColumn NVARCHAR(MAX);
SET @JoinColumn = CASE\u0020
    WHEN @TableName = 'RefTaxEntityRelationship' THEN 'TaxEntityId'
    ELSE 'RefTaxEntityId'  -- Default for most tables including PropertyRelationship
END;
\u0020
-- Build columns with conditional table name prefix
SELECT @COLUMNS = @COLUMNS +\u0020
    CASE\u0020
        WHEN COLUMN_NAME IN ('Id', 'DateTimeCreated', 'DateTimeUpdated', 'DateTimeProduced', 'DateTimeValidFrom', 'DateTimeValidTo', 'UpdatedBy', 'DataIsolationName', 'CodeAuditReason', 'CodeAuditSource', @JoinColumn)
        THEN @TableName + '.' + COLUMN_NAME\u0020
        ELSE COLUMN_NAME\u0020
    END + ' , ''|'' , '
FROM INFORMATION_SCHEMA.COLUMNS\u0020
WHERE TABLE_NAME = @TableName
  AND COLUMN_NAME != 'RowNumber'
  AND COLUMN_NAME != 'Order'
  AND COLUMN_NAME != 'RowVersion'
ORDER BY ORDINAL_POSITION;
\u0020
SET @COLUMNS = LEFT(@COLUMNS, LEN(@COLUMNS) - 8);
\u0020
-- Conditional SQL declaration based on @ByRefTax
DECLARE @SQL NVARCHAR(MAX);
\u0020
IF @ByRefTax = 1
BEGIN
    -- Use TEI1 alias for tables that have additional joins
    IF @TableName IN ('RefTaxEntityRelationship', 'PropertyRelationship')
    BEGIN
        SET @SQL = 'SELECT CONCAT(' + @COLUMNS + ') FROM ' + @TableName + ' with (nolock) JOIN RT.TaxEntityIdentifier TEI1 with (nolock) on TEI1.TaxEntityId = ' + @TableName + '.' + @JoinColumn + ' and TEI1.IsPrimary = 1';
    END
    ELSE
    BEGIN
        SET @SQL = 'SELECT CONCAT(' + @COLUMNS + ') FROM ' + @TableName + ' with (nolock) JOIN RT.TaxEntityIdentifier with (nolock) on RT.TaxEntityIdentifier.TaxEntityId = ' + @TableName + '.' + @JoinColumn + ' and IsPrimary = 1';
    END
\u0020\u0020\u0020\u0020
    -- Add additional join based on table type
    IF @TableName = 'RefTaxEntityRelationship'
    BEGIN
        SET @SQL = @SQL + ' INNER JOIN RT.TaxEntityIdentifier TEI2 with (nolock) on TEI2.TaxEntityId = ' + @TableName + '.RelatedEntityId and TEI2.IsPrimary = 1';
    END
    ELSE IF @TableName = 'PropertyRelationship'
    BEGIN
        SET @SQL = @SQL + ' INNER JOIN RT.TaxEntityIdentifier TEI2 with (nolock) on TEI2.TaxEntityId = ' + @TableName + '.RefTaxEntityIdForRelated and TEI2.IsPrimary = 1';
    END
END
ELSE
BEGIN
    SET @SQL = 'SELECT CONCAT(' + @COLUMNS + ') FROM ' + @TableName + ' with (nolock)';
END
\u0020
PRINT @SQL;`;
