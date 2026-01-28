param(
    [string]$ExcelPath = "data\Courses Masterdata.xlsx",
    [string]$OutDir = "data\course_faiss_index",
    [string]$Model = "sentence-transformers/all-MiniLM-L6-v2",
    [string]$DownloadUrl = ""
)

if ($DownloadUrl -ne "") {
    Write-Host "Downloading $DownloadUrl to $ExcelPath"
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ExcelPath -UseBasicParsing
}

python ..\app\vector_db\build_course_vector_index.py --excel $ExcelPath --out $OutDir --model $Model
