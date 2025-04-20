import os
import psycopg2

def load_sql_file():
    with open("./init-orders-db.sql", "r") as f:
        return f.read()

def lambda_handler(event, context):
    try:
        conn = psycopg2.connect(
            host=os.environ['DB_HOST'],
            dbname=os.environ['DB_NAME'],
            user=os.environ['DB_USER'],
            password=os.environ['DB_PASSWORD'],
            port=5432
        )
        cur = conn.cursor()
        sql = load_sql_file()
        cur.execute(sql)
        conn.commit()
        cur.close()
        conn.close()
        return {
            'statusCode': 200,
            'body': 'Database initialized successfully'
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': str(e)
        }
