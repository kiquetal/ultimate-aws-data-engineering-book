import boto3
import os
import json
import re

def split_sql_statements(sql):
    # Naive split on semicolon, but ignore semicolons in single/double quotes
    statements = []
    statement = ''
    in_single_quote = False
    in_double_quote = False
    for char in sql:
        if char == "'":
            in_single_quote = not in_single_quote if not in_double_quote else in_single_quote
        elif char == '"':
            in_double_quote = not in_double_quote if not in_single_quote else in_double_quote
        if char == ';' and not in_single_quote and not in_double_quote:
            if statement.strip():
                statements.append(statement.strip())
            statement = ''
        else:
            statement += char
    if statement.strip():
        statements.append(statement.strip())
    return statements

def handler(event, context):
    """
    Lambda function to execute SQL statements from a file in S3 on Redshift.
    Uses environment variables for configuration.
    Reads the SQL file from S3, splits into statements, and executes each one.
    """
    try:
        # Extract parameters from environment variables
        workgroup_name = os.environ['WORKGROUP_NAME']
        database_name = os.environ['DATABASE_NAME']
        admin_secret_arn = os.environ['ADMIN_SECRET_ARN']
        s3_bucket_name = os.environ['S3_BUCKET_NAME']
        s3_key_prefix = os.environ['S3_KEY_PREFIX']
        sql_file_name = os.environ['SQL_FILE_NAME']

        # Read SQL file from S3
        s3 = boto3.client('s3')
        sql_key = f"{s3_key_prefix}/{sql_file_name}" if s3_key_prefix else sql_file_name
        sql_obj = s3.get_object(Bucket=s3_bucket_name, Key=sql_key)
        sql_content = sql_obj['Body'].read().decode('utf-8')

        # Remove comments
        sql_content = re.sub(r'--.*', '', sql_content)
        # Split into statements
        statements = split_sql_statements(sql_content)

        # Initialize Redshift Data API client
        redshift_data = boto3.client('redshift-data')
        execution_ids = []
        errors = []
        for stmt in statements:
            if not stmt.strip():
                continue
            try:
                response = redshift_data.execute_statement(
                    WorkgroupName=workgroup_name,
                    Database=database_name,
                    SecretArn=admin_secret_arn,
                    Sql=stmt
                )
                execution_ids.append({'statement': stmt[:50], 'id': response['Id']})
            except Exception as e:
                # Continue on 'already exists' errors, log others
                msg = str(e)
                if 'already exists' in msg or 'Duplicate' in msg:
                    errors.append({'statement': stmt[:50], 'error': msg, 'skipped': True})
                    continue
                errors.append({'statement': stmt[:50], 'error': msg, 'skipped': False})

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'SQL execution attempted for all statements',
                'executionIds': execution_ids,
                'errors': errors
            })
        }

    except Exception as e:
        print(f"Error executing SQL: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': f'Error executing SQL: {str(e)}'
            })
        }
