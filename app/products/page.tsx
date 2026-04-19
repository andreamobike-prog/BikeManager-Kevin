"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import ScanProductButton from "@/components/ScanProductButton"

export default function ProductsPage(){

const [title,setTitle] = useState("")
const [ean,setEan] = useState("")
const [qty,setQty] = useState(0)
const [price,setPrice] = useState(0)

async function saveProduct(){

const { error } = await supabase
.from("products")
.insert({
title: title,
ean: ean,
warehouse_qty: qty,
price_b2c: price
})

if(error){
alert(error.message)
return
}

alert("Prodotto salvato")

setTitle("")
setEan("")
setQty(0)
setPrice(0)

}

return(

<div style={{padding:"40px"}}>

<h2>Inserisci prodotto</h2>

<br/>

<input
placeholder="Titolo prodotto"
value={title}
onChange={(e)=>setTitle(e.target.value)}
/>

<br/><br/>

<input
placeholder="EAN"
value={ean}
onChange={(e)=>setEan(e.target.value)}
/>

<br/><br/>

<ScanProductButton
onScan={(value)=>setEan(value)}
/>

<br/><br/>

<input
type="number"
placeholder="Quantità"
value={qty}
onChange={(e)=>setQty(Number(e.target.value))}
/>

<br/><br/>

<input
type="number"
placeholder="Prezzo vendita"
value={price}
onChange={(e)=>setPrice(Number(e.target.value))}
/>

<br/><br/>

<button onClick={saveProduct}>
Salva prodotto
</button>

</div>

)

}
