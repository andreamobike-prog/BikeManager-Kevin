"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function NewProductPage(){

const router = useRouter()

const [loading,setLoading] = useState(false)

const [form,setForm] = useState({
title:"",
description:"",
ean:"",
location:"",
price_b2b:0,
price_b2c:0,
warehouse_qty:0
})

async function createProduct(){

setLoading(true)

const { error } = await supabase
.from("products")
.insert({
title:form.title,
description:form.description,
ean:form.ean,
location:form.location,
price_b2b:form.price_b2b,
price_b2c:form.price_b2c,
warehouse_qty:form.warehouse_qty
})

if(!error){

router.push("/inventory")

}

setLoading(false)

}

return(

<div style={container}>

<h1>Nuovo articolo</h1>

<div style={card}>

<div style={row2}>

<input
placeholder="Nome articolo"
style={input}
value={form.title}
onChange={(e)=>setForm({...form,title:e.target.value})}
/>

<input
placeholder="EAN"
style={input}
value={form.ean}
onChange={(e)=>setForm({...form,ean:e.target.value})}
/>

</div>

<textarea
placeholder="Descrizione"
style={textarea}
value={form.description}
onChange={(e)=>setForm({...form,description:e.target.value})}
/>

<div style={row2}>

<input
placeholder="Posizione scaffale"
style={input}
value={form.location}
onChange={(e)=>setForm({...form,location:e.target.value})}
/>

<input
type="number"
placeholder="Quantità iniziale"
style={input}
value={form.warehouse_qty}
onChange={(e)=>setForm({...form,warehouse_qty:Number(e.target.value)})}
/>

</div>

<div style={row2}>

<input
type="number"
placeholder="Prezzo B2B"
style={input}
value={form.price_b2b}
onChange={(e)=>setForm({...form,price_b2b:Number(e.target.value)})}
/>

<input
type="number"
placeholder="Prezzo B2C"
style={input}
value={form.price_b2c}
onChange={(e)=>setForm({...form,price_b2c:Number(e.target.value)})}
/>

</div>

<button
onClick={createProduct}
style={saveButton}
>

{loading ? "Salvataggio..." : "Salva articolo"}

</button>

</div>

</div>

)

}

const container={
maxWidth:800,
margin:"40px auto"
}

const card={
background:"#fff",
padding:30,
borderRadius:10,
border:"1px solid #eee",
display:"flex",
flexDirection: "column" as const,
gap:20
}

const row2={
display:"grid",
gridTemplateColumns:"1fr 1fr",
gap:20
}

const input={
padding:12,
border:"1px solid #ddd",
borderRadius:6
}

const textarea={
padding:12,
border:"1px solid #ddd",
borderRadius:6,
height:120
}

const saveButton={
background:"#4f7cff",
color:"#fff",
border:"none",
padding:"12px 20px",
borderRadius:6,
cursor:"pointer"
}