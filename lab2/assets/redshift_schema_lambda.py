import boto3
import os
import json
import io
import botocore

def handler(event, context):
    """
    Lambda function to execute SQL statements from a file in S3 on Redshift.
    Uses environment variables for configuration.
    Reads the SQL file from S3 and sends its contents as the SQL statement.
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

        # Initialize Redshift Data API client
        redshift_data = boto3.client('redshift-data')

        # Execute the SQL content
        response = redshift_data.execute_statement(
            WorkgroupName=workgroup_name,
            Database=database_name,
            SecretArn=admin_secret_arn,
            Sql=sql_content
        )

        # Return the execution ID for tracking
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'SQL execution started successfully',
                'executionId': response['Id']
            })
        }

    except Exception as e:
        # Log the error and return a failure response
        print(f"Error executing SQL: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': f'Error executing SQL: {str(e)}'
            })
        }
