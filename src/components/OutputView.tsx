import { useState } from 'react'
import { Badge, Button, Flex, Text } from '@radix-ui/themes'
import type { OutputFile } from '../hooks/usePythonRunner'
import type { PythonRunStatus } from '../hooks/usePythonRunner'

type OutputViewProps = {
  output: string
  systemOutput: string
  status: PythonRunStatus
  isBusy: boolean
  images: { name: string; dataUrl: string }[]
  dataFiles: OutputFile[]
  onClear: () => void
}

const statusLabels: Record<PythonRunStatus, string> = {
  idle: 'Ready',
  loading: 'Loading Python',
  running: 'Running',
  success: 'Finished',
  error: 'Error',
  stopped: 'Stopped',
}

const statusColor = (status: PythonRunStatus) => {
  if (status === 'error') return 'red'
  if (status === 'success') return 'grass'
  if (status === 'stopped') return 'amber'
  return 'gray'
}

/** Trigger a browser download from a base64 data URL. */
function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function FilePreview({ file }: { file: OutputFile }) {
  const [showPreview, setShowPreview] = useState(false)

  return (
    <div className="output-file">
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Text as="span" size="2" weight="medium">
          {file.name}
        </Text>
        <Flex align="center" gap="2">
          <button
            type="button"
            className="data-item-toggle"
            onClick={() => setShowPreview((value) => !value)}
          >
            {showPreview ? 'Hide' : 'Preview'}
          </button>
          <Button
            type="button"
            size="1"
            variant="soft"
            onClick={() => downloadDataUrl(file.dataUrl, file.name)}
          >
            Download
          </Button>
        </Flex>
      </Flex>
      {showPreview && (
        <pre className="output-file-preview">
          {decodeDataUrl(file.dataUrl)}
        </pre>
      )}
    </div>
  )
}

/** Decode a base64 data URL to text for preview. */
function decodeDataUrl(dataUrl: string): string {
  const base64 = dataUrl.split(',')[1] ?? ''
  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new TextDecoder().decode(bytes)
  } catch {
    return 'Unable to preview this file.'
  }
}

export function OutputView({
  output,
  systemOutput,
  status,
  isBusy,
  images,
  dataFiles,
  onClear,
}: OutputViewProps) {
  return (
    <div className="output-view">
      <Flex align="center" justify="between" gap="3" wrap="wrap" mb="3">
        <Flex align="center" gap="2">
          <Text as="span" size="2" weight="bold">
            Console
          </Text>
          <Badge size="1" color={statusColor(status)} variant="soft">
            {statusLabels[status]}
          </Badge>
        </Flex>
        <Button
          type="button"
          size="1"
          variant="ghost"
          disabled={!output || isBusy}
          onClick={onClear}
        >
          Clear
        </Button>
      </Flex>
      <pre
        className={`python-output${status === 'error' ? ' python-output-error' : ''}`}
        aria-busy={isBusy}
        aria-live="polite"
        role="log"
      >
        {output ||
          (status === 'loading'
            ? 'Preparing the Python runtime…'
            : status === 'running'
              ? 'Running Python…'
              : status === 'success'
                ? 'Code finished without producing output.'
                : 'Run the generated Python to see its output.')}
      </pre>

      {systemOutput && (
        <details className="system-output">
          <summary>System</summary>
          <pre className="python-output system-output-body">{systemOutput}</pre>
        </details>
      )}

      {images.length > 0 && (
        <div className="output-section">
          <Flex align="center" justify="between" gap="3" wrap="wrap" mb="2">
            <Text as="span" size="2" weight="bold">
              Plots
            </Text>
            <Text as="span" size="2" color="gray">
              {images.length} image{images.length > 1 ? 's' : ''} generated
            </Text>
          </Flex>
          <div className="plot-gallery">
            {images.map((image) => (
              <figure key={image.name} className="plot-figure">
                <img src={image.dataUrl} alt={image.name} />
                <figcaption>{image.name}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      {dataFiles.length > 0 && (
        <div className="output-section">
          <Flex align="center" gap="2" mb="2">
            <Text as="span" size="2" weight="bold">
              Exported files
            </Text>
            <Badge size="1" color="gray" variant="soft">
              {dataFiles.length}
            </Badge>
          </Flex>
          {dataFiles.map((file) => (
            <FilePreview key={file.name} file={file} />
          ))}
        </div>
      )}
    </div>
  )
}
