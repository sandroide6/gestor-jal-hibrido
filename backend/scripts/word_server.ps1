# word_server.ps1 — Servidor Word COM persistente
# Lee peticiones JSON de stdin, convierte DOCX a PDF, responde JSON a stdout.
$ErrorActionPreference = 'Stop'
$word = $null

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0

    [Console]::Out.WriteLine('{"ready":true}')
    [Console]::Out.Flush()

    while ($true) {
        $line = [Console]::In.ReadLine()
        if ($null -eq $line) { break }
        $line = $line.Trim()
        if (-not $line) { continue }

        try {
            $req = $line | ConvertFrom-Json
            $doc = $word.Documents.Open($req.docx)
            $doc.ExportAsFixedFormat($req.pdf, 17)
            $doc.Close([ref]$false)
            [Console]::Out.WriteLine('{"id":' + $req.id + ',"ok":true}')
        } catch {
            $errMsg = $_.Exception.Message -replace '"', "'"
            [Console]::Out.WriteLine('{"id":' + $req.id + ',"ok":false,"error":"' + $errMsg + '"}')
        }
        [Console]::Out.Flush()
    }
} finally {
    if ($null -ne $word) {
        try { $word.Quit() } catch {}
        try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null } catch {}
    }
}
