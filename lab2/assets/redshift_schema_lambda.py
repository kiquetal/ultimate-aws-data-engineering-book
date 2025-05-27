import boto3
import os
import json

def handler(event, context):
    """
    Lambda function to execute SQL statements from a file in S3 on Redshift.
    Uses environment variables for configuration.
    """
    try:
        # Extract parameters from environment variables
        workgroup_name = os.environ['WORKGROUP_NAME']
        database_name = os.environ['DATABASE_NAME']
        admin_secret_arn = os.environ['ADMIN_SECRET_ARN']
        s3_bucket_name = os.environ['S3_BUCKET_NAME']
        s3_key_prefix = os.environ['S3_KEY_PREFIX']
        sql_file_name = os.environ['SQL_FILE_NAME']

        # Initialize Redshift Data API client
        redshift_data = boto3.client('redshift-data')

        # Construct the SQL command to execute the script from S3
        sql_command = f"\\set ON_ERROR_STOP on\n\\i s3://{s3_bucket_name}/{s3_key_prefix}/{sql_file_name}"

        # Execute the SQL command
        response = redshift_data.execute_statement(
            WorkgroupName=workgroup_name,
            Database=database_name,
            SecretArn=admin_secret_arn,
            Sql=sql_command
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
