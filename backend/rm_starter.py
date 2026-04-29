import sqlite3

c = sqlite3.connect('db.sqlite3')
cur = c.cursor()
cur.execute("SELECT id FROM fitness_goalplan WHERE title='Starter Strength Week'")
ids = [r[0] for r in cur.fetchall()]
print('Found plan IDs:', ids)
if ids:
    ph = ','.join('?' * len(ids))
    cur.execute(f'DELETE FROM fitness_goalexercise WHERE goal_plan_id IN ({ph})', ids)
    print('Deleted goal exercises:', cur.rowcount)
    cur.execute(f'DELETE FROM fitness_goalplan WHERE id IN ({ph})', ids)
    print('Deleted goal plans:', cur.rowcount)
    c.commit()
else:
    print('Nothing to delete.')
c.close()
print('Done.')
