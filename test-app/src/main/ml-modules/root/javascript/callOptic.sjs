const op = require('/MarkLogic/optic');

op.fromView('Medical', 'Authors')
    .where(op.eq(op.col('ID'), 5))
    .select(['LastName', 'ForeName'])
    .result();