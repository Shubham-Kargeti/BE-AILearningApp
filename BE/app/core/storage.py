"""S3-compatible storage service for document uploads."""
import io
import os
from typing import Optional, BinaryIO, Union
from datetime import datetime, timedelta
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from config import get_settings

settings = get_settings()


class S3Service:
    """S3-compatible storage service."""
    
    def __init__(self):
        """Initialize S3 client."""
        self.s3_client = boto3.client(
            's3',
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION,
            config=Config(signature_version='s3v4'),
            use_ssl=settings.S3_USE_SSL,
        )
        self.bucket_name = settings.S3_BUCKET_NAME
        self._ensure_bucket_exists()
    
    def _ensure_bucket_exists(self) -> None:
        """Ensure the S3 bucket exists, create if not."""
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == '404':
                try:
                    self.s3_client.create_bucket(Bucket=self.bucket_name)
                except ClientError as create_error:
                    print(f"Error creating bucket: {create_error}")
            else:
                print(f"Error checking bucket: {e}")
    
    def upload_file(
        self,
        file_obj: BinaryIO,
        object_name: str,
        content_type: Optional[str] = None,
        metadata: Optional[dict] = None
    ) -> str:
        """
        Upload file to S3.
        
        Args:
            file_obj: File object to upload
            object_name: S3 object key/path
            content_type: MIME type of the file
            metadata: Additional metadata
        
        Returns:
            S3 object key
        """
        extra_args = {}
        
        if content_type:
            extra_args['ContentType'] = content_type
        
        if metadata:
            extra_args['Metadata'] = metadata
        
        # boto3's upload_fileobj requires a file-like object implementing .read().
        # Accept bytes/bytearray as a convenience and wrap them in BytesIO.
        if isinstance(file_obj, (bytes, bytearray)):
            file_obj = io.BytesIO(file_obj)

        if not hasattr(file_obj, "read"):
            raise TypeError("file_obj must be a file-like object with a read() method or bytes")

        try:
            self.s3_client.upload_fileobj(
                file_obj,
                self.bucket_name,
                object_name,
                ExtraArgs=extra_args
            )
            return object_name
        except ClientError as e:
            raise Exception(f"Failed to upload file to S3: {e}")
    
    def download_file(self, object_name: str) -> bytes:
        """
        Download file from S3.
        
        Args:
            object_name: S3 object key
        
        Returns:
            File contents as bytes
        """
        try:
            buffer = io.BytesIO()
            self.s3_client.download_fileobj(
                self.bucket_name,
                object_name,
                buffer
            )
            buffer.seek(0)
            return buffer.read()
        except ClientError as e:
            raise Exception(f"Failed to download file from S3: {e}")
    
    def get_file_stream(self, object_name: str) -> BinaryIO:
        """
        Get file as stream from S3.
        
        Args:
            object_name: S3 object key
        
        Returns:
            File stream
        """
        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=object_name
            )
            return response['Body']
        except ClientError as e:
            raise Exception(f"Failed to get file stream from S3: {e}")
    
    def delete_file(self, object_name: str) -> bool:
        """
        Delete file from S3.
        
        Args:
            object_name: S3 object key
        
        Returns:
            True if successful
        """
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=object_name
            )
            return True
        except ClientError as e:
            raise Exception(f"Failed to delete file from S3: {e}")
    
    def file_exists(self, object_name: str) -> bool:
        """
        Check if file exists in S3.
        
        Args:
            object_name: S3 object key
        
        Returns:
            True if file exists
        """
        try:
            self.s3_client.head_object(
                Bucket=self.bucket_name,
                Key=object_name
            )
            return True
        except ClientError:
            return False
    
    def get_file_metadata(self, object_name: str) -> Optional[dict]:
        """
        Get file metadata from S3.
        
        Args:
            object_name: S3 object key
        
        Returns:
            File metadata dict
        """
        try:
            response = self.s3_client.head_object(
                Bucket=self.bucket_name,
                Key=object_name
            )
            return {
                'size': response['ContentLength'],
                'content_type': response.get('ContentType'),
                'last_modified': response['LastModified'],
                'metadata': response.get('Metadata', {}),
            }
        except ClientError:
            return None
    
    def generate_presigned_url(
        self,
        object_name: str,
        expiration: int = 3600,
        http_method: str = 'GET'
    ) -> str:
        """
        Generate presigned URL for temporary access.
        
        Args:
            object_name: S3 object key
            expiration: URL expiration in seconds
            http_method: HTTP method (GET or PUT)
        
        Returns:
            Presigned URL
        """
        try:
            method_map = {
                'GET': 'get_object',
                'PUT': 'put_object',
            }
            
            url = self.s3_client.generate_presigned_url(
                method_map.get(http_method, 'get_object'),
                Params={
                    'Bucket': self.bucket_name,
                    'Key': object_name
                },
                ExpiresIn=expiration
            )
            return url
        except ClientError as e:
            raise Exception(f"Failed to generate presigned URL: {e}")
    
    def list_files(self, prefix: str = '') -> list[dict]:
        """
        List files in S3 bucket.
        
        Args:
            prefix: Filter by prefix
        
        Returns:
            List of file metadata dicts
        """
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix
            )
            
            files = []
            for obj in response.get('Contents', []):
                files.append({
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'],
                })
            
            return files
        except ClientError as e:
            raise Exception(f"Failed to list files: {e}")
    
    def generate_upload_key(
        self,
        user_id: Optional[int],
        filename: str,
        prefix: str = 'uploads'
    ) -> str:
        """
        Generate unique S3 key for upload.
        
        Args:
            user_id: User ID
            filename: Original filename
            prefix: Folder prefix
        
        Returns:
            S3 object key
        """
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        user_prefix = f"user_{user_id}" if user_id else "anonymous"
        return f"{prefix}/{user_prefix}/{timestamp}_{filename}"


# Singleton instance
_s3_service: Optional[Union[S3Service, 'LocalStorageService']] = None


def get_s3_service() -> Union[S3Service, 'LocalStorageService']:
    """Get S3 service singleton."""
    global _s3_service
    if _s3_service is None:
        try:
            _s3_service = S3Service()
        except Exception as e:
            # If S3 endpoint is not available (e.g., MinIO not running locally),
            # fallback to a simple local-file storage implementation for dev.
            print(f"S3 initialization failed, falling back to LocalStorageService: {e}")
            _s3_service = LocalStorageService(base_dir=os.path.join("data", "local_storage"), bucket_name=settings.S3_BUCKET_NAME)
    return _s3_service


class LocalStorageService:
    """A lightweight local-file fallback for S3-compatible operations (dev only)."""

    def __init__(self, base_dir: str = os.path.join("data", "local_storage"), bucket_name: str = "learning-app-docs"):
        self.base_dir = base_dir
        self.bucket_name = bucket_name
        os.makedirs(self._bucket_dir(), exist_ok=True)

    def _bucket_dir(self) -> str:
        return os.path.join(self.base_dir, self.bucket_name)

    def _object_path(self, object_name: str) -> str:
        # sanitize object_name to avoid absolute paths
        safe_name = object_name.lstrip("/")
        return os.path.join(self._bucket_dir(), safe_name)

    def upload_file(self, file_obj: BinaryIO, object_name: str, content_type: Optional[str] = None, metadata: Optional[dict] = None) -> str:
        path = self._object_path(object_name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        # file_obj may be bytes or a file-like
        if isinstance(file_obj, (bytes, bytearray)):
            data = file_obj
        else:
            try:
                data = file_obj.read()
            except Exception:
                # fallback: try converting to bytes
                data = bytes(file_obj)

        with open(path, "wb") as f:
            f.write(data)

        return object_name

    def download_file(self, object_name: str) -> bytes:
        path = self._object_path(object_name)
        with open(path, "rb") as f:
            return f.read()

    def get_file_stream(self, object_name: str) -> BinaryIO:
        path = self._object_path(object_name)
        return open(path, "rb")

    def delete_file(self, object_name: str) -> bool:
        path = self._object_path(object_name)
        try:
            os.remove(path)
            return True
        except FileNotFoundError:
            return False

    def file_exists(self, object_name: str) -> bool:
        return os.path.exists(self._object_path(object_name))

    def get_file_metadata(self, object_name: str) -> Optional[dict]:
        path = self._object_path(object_name)
        if not os.path.exists(path):
            return None
        stat = os.stat(path)
        return {
            'size': stat.st_size,
            'content_type': None,
            'last_modified': datetime.fromtimestamp(stat.st_mtime),
            'metadata': {},
        }

    def generate_presigned_url(self, object_name: str, expiration: int = 3600, http_method: str = 'GET') -> str:
        path = self._object_path(object_name)
        # Return a file:// URL for dev convenience
        return f"file://{os.path.abspath(path)}"

    def list_files(self, prefix: str = '') -> list[dict]:
        base = os.path.join(self._bucket_dir(), prefix.lstrip('/'))
        files = []
        if not os.path.exists(base):
            return files
        for root, _, filenames in os.walk(base):
            for name in filenames:
                p = os.path.join(root, name)
                rel = os.path.relpath(p, self._bucket_dir())
                stat = os.stat(p)
                files.append({'key': rel.replace('\\', '/'), 'size': stat.st_size, 'last_modified': datetime.fromtimestamp(stat.st_mtime)})
        return files
