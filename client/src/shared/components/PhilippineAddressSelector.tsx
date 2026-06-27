import * as React from "react";
import { AlertCircle } from "lucide-react";
import { AddressCombobox, type AddressComboboxItem } from "./AddressCombobox";
import api from "@/shared/api/axiosInstance";

export interface PhilippineAddressValue {
  region: string;
  province: string;
  cityMunicipality: string;
  barangay: string;
}

export interface PhilippineAddressErrors {
  region?: string;
  province?: string;
  cityMunicipality?: string;
  barangay?: string;
}

interface PhilippineAddressSelectorProps {
  value: PhilippineAddressValue;
  onChange: (
    field: "region" | "province" | "cityMunicipality" | "barangay",
    value: string,
  ) => void;
  errors?: PhilippineAddressErrors;
  required?: boolean;
}

interface SelectedParent {
  code: string;
  name: string;
}

export function PhilippineAddressSelector({
  value,
  onChange,
  errors,
  required,
}: PhilippineAddressSelectorProps) {
  const [regions, setRegions] = React.useState<AddressComboboxItem[]>([]);
  const [provinces, setProvinces] = React.useState<AddressComboboxItem[]>([]);
  const [cities, setCities] = React.useState<AddressComboboxItem[]>([]);
  const [barangays, setBarangays] = React.useState<AddressComboboxItem[]>([]);

  // Internal cascade selections (code+name pairs not stored in form)
  const [selectedRegion, setSelectedRegion] =
    React.useState<SelectedParent | null>(null);
  const [selectedProvince, setSelectedProvince] =
    React.useState<SelectedParent | null>(null);
  const [selectedCity, setSelectedCity] =
    React.useState<SelectedParent | null>(null);

  const [loadingProvinces, setLoadingProvinces] = React.useState(false);
  const [loadingCities, setLoadingCities] = React.useState(false);
  const [loadingBarangays, setLoadingBarangays] = React.useState(false);

  // Load regions on mount
  React.useEffect(() => {
    api
      .get<{ data: AddressComboboxItem[] }>("/address/regions")
      .then((r) => {
        setRegions(r.data.data);
        // If a region is pre-selected in the value, set it as selected
        if (value.region && !selectedRegion) {
          const matched = r.data.data.find(x => x.name.toUpperCase() === value.region.toUpperCase());
          if (matched) {
            setSelectedRegion({ code: matched.code, name: matched.name });
          }
        }
      })
      .catch(() => setRegions([]));
  }, [value.region, selectedRegion]);

  // Load provinces when region changes
  React.useEffect(() => {
    if (!selectedRegion) {
      setProvinces([]);
      return;
    }
    setLoadingProvinces(true);
    api
      .get<{ data: AddressComboboxItem[] }>(
        `/address/provinces/${selectedRegion.code}`,
      )
      .then((r) => {
        setProvinces(r.data.data);
        if (value.province && !selectedProvince) {
          const matched = r.data.data.find(x => x.name.toUpperCase() === value.province.toUpperCase());
          if (matched) {
            setSelectedProvince({ code: matched.code, name: matched.name });
          }
        }
      })
      .catch(() => setProvinces([]))
      .finally(() => setLoadingProvinces(false));
  }, [selectedRegion, value.province, selectedProvince]);

  // Load cities when province changes
  React.useEffect(() => {
    if (!selectedProvince) {
      setCities([]);
      return;
    }
    setLoadingCities(true);
    api
      .get<{ data: AddressComboboxItem[] }>(
        `/address/cities/${selectedProvince.code}`,
      )
      .then((r) => {
        setCities(r.data.data);
        if (value.cityMunicipality && !selectedCity) {
          const matched = r.data.data.find(x => x.name.toUpperCase() === value.cityMunicipality.toUpperCase());
          if (matched) {
            setSelectedCity({ code: matched.code, name: matched.name });
          }
        }
      })
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [selectedProvince, value.cityMunicipality, selectedCity]);

  // Load barangays when city changes
  React.useEffect(() => {
    if (!selectedCity) {
      setBarangays([]);
      return;
    }
    setLoadingBarangays(true);
    api
      .get<{ data: AddressComboboxItem[] }>(
        `/address/barangays/${selectedCity.code}`,
      )
      .then((r) => setBarangays(r.data.data))
      .catch(() => setBarangays([]))
      .finally(() => setLoadingBarangays(false));
  }, [selectedCity]);

  function handleRegionChange(name: string, code: string) {
    setSelectedRegion({ code, name: name.toUpperCase() });
    setSelectedProvince(null);
    setSelectedCity(null);
    // Clear downstream form values
    onChange("region", name.toUpperCase());
    onChange("province", "");
    onChange("cityMunicipality", "");
    onChange("barangay", "");
  }

  function handleProvinceChange(name: string, code: string) {
    setSelectedProvince({ code, name: name.toUpperCase() });
    setSelectedCity(null);
    onChange("province", name.toUpperCase());
    onChange("cityMunicipality", "");
    onChange("barangay", "");
  }

  function handleCityChange(name: string, code: string) {
    setSelectedCity({ code, name: name.toUpperCase() });
    onChange("cityMunicipality", name.toUpperCase());
    onChange("barangay", "");
  }

  function handleBarangayChange(name: string, _code: string) {
    onChange("barangay", name.toUpperCase());
  }

  const requiredMark = required ? (
    <span className="text-destructive"> *</span>
  ) : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Region */}
      <div className="space-y-1.5">
        <label className="text-base font-extrabold uppercase text-foreground">
          Region{requiredMark}
        </label>
        <AddressCombobox
          items={regions}
          value={value.region || selectedRegion?.name || ""}
          onChange={handleRegionChange}
          placeholder="Select region…"
          searchPlaceholder="Search regions…"
          error={!!errors?.region}
        />
        {errors?.region && (
          <p className="text-base text-destructive font-extrabold flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors.region}
          </p>
        )}
      </div>

      {/* Province */}
      <div className="space-y-1.5">
        <label className="text-base font-extrabold uppercase text-foreground">
          Province{requiredMark}
        </label>
        <AddressCombobox
          items={loadingProvinces ? [] : provinces}
          value={value.province}
          onChange={handleProvinceChange}
          placeholder={
            !selectedRegion
              ? "Select region first"
              : loadingProvinces
                ? "Loading…"
                : "Select province…"
          }
          searchPlaceholder="Search provinces…"
          disabled={!selectedRegion || loadingProvinces}
          error={!!errors?.province}
        />
        {errors?.province && (
          <p className="text-base text-destructive font-extrabold flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors.province}
          </p>
        )}
      </div>

      {/* City / Municipality */}
      <div className="space-y-1.5">
        <label className="text-base font-extrabold uppercase text-foreground">
          City / Municipality{requiredMark}
        </label>
        <AddressCombobox
          items={loadingCities ? [] : cities}
          value={value.cityMunicipality}
          onChange={handleCityChange}
          placeholder={
            !selectedProvince
              ? "Select province first"
              : loadingCities
                ? "Loading…"
                : "Select city / municipality…"
          }
          searchPlaceholder="Search cities…"
          disabled={!selectedProvince || loadingCities}
          error={!!errors?.cityMunicipality}
        />
        {errors?.cityMunicipality && (
          <p className="text-base text-destructive font-extrabold flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors.cityMunicipality}
          </p>
        )}
      </div>

      {/* Barangay */}
      <div className="space-y-1.5">
        <label className="text-base font-extrabold uppercase text-foreground">
          Barangay{requiredMark}
        </label>
        <AddressCombobox
          items={loadingBarangays ? [] : barangays}
          value={value.barangay}
          onChange={handleBarangayChange}
          placeholder={
            !selectedCity
              ? "Select city first"
              : loadingBarangays
                ? "Loading…"
                : "Select barangay…"
          }
          searchPlaceholder="Search barangays…"
          disabled={!selectedCity || loadingBarangays}
          error={!!errors?.barangay}
        />
        {errors?.barangay && (
          <p className="text-base text-destructive font-extrabold flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors.barangay}
          </p>
        )}
      </div>
    </div>
  );
}
