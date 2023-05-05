op.fromView('Medical', 'Authors')
    .where(op.eq(op.col('ID'), 5))
    .select(['LastName', 'ForeName'])
