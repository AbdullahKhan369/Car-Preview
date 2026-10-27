import Lightbox from 'yet-another-react-lightbox'
import Counter from 'yet-another-react-lightbox/plugins/counter'
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/counter.css'

export default function LightboxView({ images, index, onClose }: { images: { src: string; alt: string }[]; index: number; onClose: () => void }) {
  return (
    <Lightbox
      open
      close={onClose}
      index={index}
      slides={images}
      plugins={[Zoom, Counter, Fullscreen]}
      zoom={{ maxZoomPixelRatio: 4, scrollToZoom: true }}
      controller={{ closeOnBackdropClick: true }}
      carousel={{ finite: images.length <= 1 }}
    />
  )
}
