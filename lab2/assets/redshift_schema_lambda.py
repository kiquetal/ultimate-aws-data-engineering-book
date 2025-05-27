import boto3
import os
import json

def handler(event, context):
    """
    Lambda function to execute SQL statements from a file in S3 on Redshift.

    Parameters:
    - event: Contains information about the event that triggered the Lambda function
    - context: Provides methods and properties about the invocation, function, and execution environment

    Expected event structure:
    {
        "workgroupName": "string",
        "databaseName": "string",
        "adminSecretArn": "string",
        "s3BucketName": "string",
        "s3KeyPrefix": "string",
        "sqlFileName": "string"
    }

    Returns:
    - A dictionary with the execution status and any relevant information
    """
    try:
        # Extract parameters from the event
        workgroup_name = event['workgroupName']
        database_name = event['databaseName']
        admin_secret_arn = event['adminSecretArn']
        s3_bucket_name = event['s3BucketName']
        s3_key_prefix = event['s3KeyPrefix']
        sql_file_name = event['sqlFileName']

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
