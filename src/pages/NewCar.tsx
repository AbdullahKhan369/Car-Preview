import { Helmet } from 'react-helmet-async'
import CarForm from '../components/CarForm'

export default function NewCar() {
  return (
    <>
      <Helmet><title>New car | Car Preview</title></Helmet>
      <CarForm mode="create" />
    </>
  )
}
